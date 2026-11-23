package ch.ethy.todo.push;

import ch.ethy.todo.domain.PushSubscription;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.PushSubscriptionRepository;
import ch.ethy.todo.service.NotFoundException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** The devices that show Critical Now as a notification. */
@Service
@Transactional
public class PushDevices {

  /**
   * The push services of the browsers there are. The server posts to whatever endpoint a device
   * names, so an open list would let any signed-in user point it at an address of their choosing.
   */
  private static final List<String> PUSH_SERVICES =
      List.of(
          "fcm.googleapis.com",
          "push.services.mozilla.com",
          "notify.windows.com",
          "push.apple.com");

  private static final int AUTH_SECRET_LENGTH = 16;

  private final PushSubscriptionRepository subscriptions;
  private final PushGateway gateway;
  private final CriticalNowPusher pusher;

  public PushDevices(
      PushSubscriptionRepository subscriptions, PushGateway gateway, CriticalNowPusher pusher) {
    this.subscriptions = subscriptions;
    this.gateway = gateway;
    this.pusher = pusher;
  }

  @Transactional(readOnly = true)
  public Optional<String> publicKey() {
    return gateway.publicKey();
  }

  /**
   * Sends the device its Critical Now once the registration is committed, so that whatever it is
   * sent is read after it.
   */
  public PushSubscription register(User user, String endpoint, String p256dh, String auth) {
    if (gateway.publicKey().isEmpty()) {
      throw new NotFoundException("This server sends no notifications");
    }
    mustBeAPushService(endpoint);
    mustBeUsable(p256dh, auth);
    PushSubscription device =
        subscriptions
            .findReachable(endpoint, user, auth)
            .map(
                known -> {
                  known.handTo(user, p256dh, auth);
                  return known;
                })
            .orElseGet(() -> added(new PushSubscription(user, endpoint, p256dh, auth)));
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            pusher.welcome(device.id());
          }
        });
    return device;
  }

  /**
   * For a device that has signed out, so there is no session to ask: holding the subscription's own
   * secret is what proves it is that device, and all it can do is stop that device's notification.
   */
  public void remove(String endpoint, String auth) {
    subscriptions.deleteByEndpointAndAuth(endpoint, auth);
  }

  /** An endpoint out of reach that is taken all the same belongs to someone else. */
  private PushSubscription added(PushSubscription device) {
    try {
      return subscriptions.saveAndFlush(device);
    } catch (DataIntegrityViolationException e) {
      throw new NotFoundException("No such device");
    }
  }

  private static void mustBeAPushService(String endpoint) {
    URI uri;
    try {
      uri = new URI(endpoint);
    } catch (URISyntaxException | NullPointerException e) {
      throw new IllegalArgumentException("A push endpoint must be a URL");
    }
    String host = uri.getHost();
    boolean known =
        "https".equals(uri.getScheme())
            && uri.getRawUserInfo() == null
            && host != null
            && PUSH_SERVICES.stream()
                .anyMatch(service -> host.equals(service) || host.endsWith("." + service));
    // Stored as ascii: anything else is refused here rather than by the database.
    if (!known || !uri.toASCIIString().equals(endpoint)) {
      throw new IllegalArgumentException("Not the push service of a browser this server knows");
    }
  }

  private static void mustBeUsable(String p256dh, String auth) {
    try {
      P256.publicKey(Base64.getUrlDecoder().decode(p256dh));
      if (Base64.getUrlDecoder().decode(auth).length != AUTH_SECRET_LENGTH) {
        throw new IllegalArgumentException("A push secret is 16 octets");
      }
    } catch (IllegalArgumentException | NullPointerException e) {
      throw new IllegalArgumentException("Not a push subscription's keys", e);
    }
  }
}
