package ch.ethy.todo.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.ethy.todo.domain.PushSubscription;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.PushSubscriptionRepository;
import ch.ethy.todo.service.NotFoundException;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class PushDevicesTest {

  private static final User ME = user(1L, "me");
  private static final User SOMEONE = user(2L, "someone");

  private static User user(long id, String name) {
    User user = new User(name, name + "@example.com", name);
    ReflectionTestUtils.setField(user, "id", id);
    return user;
  }

  private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-1";
  private static final String P256DH =
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
  private static final String AUTH = "BTBZMqHH6r4Tts7J_aSIgg";

  private PushSubscriptionRepository subscriptions;
  private PushDevices devices;

  @BeforeEach
  void devices() {
    subscriptions = mock(PushSubscriptionRepository.class);
    when(subscriptions.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
    PushGateway on = mock(PushGateway.class);
    when(on.publicKey()).thenReturn(Optional.of("key"));
    devices = new PushDevices(subscriptions, on, mock(CriticalNowPusher.class));
    // Registering hands the welcome to the commit; outside a transaction there is none to wait for.
    TransactionSynchronizationManager.initSynchronization();
  }

  @AfterEach
  void clear() {
    TransactionSynchronizationManager.clearSynchronization();
  }

  @Test
  @DisplayName("a new endpoint becomes this user's device")
  void registersANewDevice() {
    PushSubscription device = devices.register(ME, ENDPOINT, P256DH, AUTH);

    assertThat(device.user()).isSameAs(ME);
    assertThat(device.endpoint()).isEqualTo(ENDPOINT);
    verify(subscriptions).saveAndFlush(device);
  }

  @Test
  @DisplayName("a device's own secret hands it to whoever registers it now, with the keys it sent")
  void handsAKnownDeviceOver() {
    var known = new PushSubscription(SOMEONE, ENDPOINT, "old-key", AUTH);
    when(subscriptions.findReachable(ENDPOINT, ME, AUTH)).thenReturn(Optional.of(known));

    PushSubscription device = devices.register(ME, ENDPOINT, P256DH, AUTH);

    assertThat(device).isSameAs(known);
    assertThat(device.user()).isSameAs(ME);
    assertThat(device.p256dh()).isEqualTo(P256DH);
    assertThat(device.auth()).isEqualTo(AUTH);
  }

  @Test
  @DisplayName(
      "an endpoint out of reach that is taken all the same is someone else's: no such device")
  void keepsSomeoneElsesDevice() {
    when(subscriptions.saveAndFlush(any()))
        .thenThrow(new DataIntegrityViolationException("uq_push_subscription_endpoint"));

    assertThatThrownBy(() -> devices.register(ME, ENDPOINT, P256DH, AUTH))
        .isInstanceOf(NotFoundException.class)
        .hasMessage("No such device");
  }

  @Test
  @DisplayName("the same person registering their device again may renew its keys")
  void renewsOwnKeys() {
    var mine = new PushSubscription(ME, ENDPOINT, "old-key", "old-auth");
    when(subscriptions.findReachable(ENDPOINT, ME, AUTH)).thenReturn(Optional.of(mine));

    assertThat(devices.register(ME, ENDPOINT, P256DH, AUTH).auth()).isEqualTo(AUTH);
  }

  @ParameterizedTest(name = "{0}")
  @ValueSource(
      strings = {
        "https://fcm.googleapis.com/fcm/send/ünicode",
        "http://fcm.googleapis.com/fcm/send/x",
        "https://localhost/push",
        "https://10.0.0.1/push",
        "https://evilgoogleapis.com/push",
        "https://storage.googleapis.com/bucket",
        "https://fcm.googleapis.com.attacker.net/push",
        "https://user@fcm.googleapis.com/push",
        "not a url"
      })
  @DisplayName("an endpoint that is not a known push service is refused, since we post to it")
  void refusesForeignEndpoints(String endpoint) {
    assertThatThrownBy(() -> devices.register(ME, endpoint, P256DH, AUTH))
        .isInstanceOf(IllegalArgumentException.class);
    verify(subscriptions, never()).saveAndFlush(any());
  }

  @ParameterizedTest(name = "{0}")
  @ValueSource(
      strings = {
        "https://fcm.googleapis.com/fcm/send/x",
        "https://updates.push.services.mozilla.com/wpush/v2/x",
        "https://wns2-par02p.notify.windows.com/w/?token=x",
        "https://web.push.apple.com/x"
      })
  @DisplayName("the push services of Chrome, Firefox, Edge and Safari are accepted")
  void acceptsKnownPushServices(String endpoint) {
    assertThat(devices.register(ME, endpoint, P256DH, AUTH).endpoint()).isEqualTo(endpoint);
  }

  @Test
  @DisplayName("keys that cannot encrypt a push are refused when they arrive, not when it is sent")
  void refusesUnusableKeys() {
    assertThatThrownBy(() -> devices.register(ME, ENDPOINT, "BAAA", AUTH))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> devices.register(ME, ENDPOINT, P256DH, "c2hvcnQ"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> devices.register(ME, ENDPOINT, P256DH, "not base64!"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("with no keys configured, there is nothing to register for")
  void offWithoutKeys() {
    var off = new PushDevices(subscriptions, PushGateway.OFF, mock(CriticalNowPusher.class));

    assertThat(off.publicKey()).isEmpty();
    assertThatThrownBy(() -> off.register(ME, ENDPOINT, P256DH, AUTH))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("a removal names the device by its endpoint and its secret together")
  void removesWithTheSecret() {
    devices.remove(ENDPOINT, AUTH);

    verify(subscriptions).deleteByEndpointAndAuth(ENDPOINT, AUTH);
  }
}
