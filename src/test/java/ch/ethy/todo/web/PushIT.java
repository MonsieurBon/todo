package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.ethy.todo.IntegrationTest;
import ch.ethy.todo.domain.PushSubscription;
import ch.ethy.todo.repository.PushSubscriptionRepository;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;

/** Registering a device for Critical Now notifications, against the real schema and wiring. */
class PushIT extends IntegrationTest {

  private static final String P256DH =
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
  private static final String AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
  private static final AtomicLong UNIQUE = new AtomicLong();

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;
  @Autowired private PushSubscriptionRepository subscriptions;

  /** Read the way the server never does: by endpoint alone, whoever's it is. */
  private Optional<PushSubscription> stored(String endpoint) {
    return subscriptions.findAllWithUser().stream()
        .filter(device -> device.endpoint().equals(endpoint))
        .findFirst();
  }

  private static String someone() {
    return "push-" + UNIQUE.incrementAndGet() + "-" + System.nanoTime();
  }

  private static String anEndpoint() {
    return "https://fcm.googleapis.com/fcm/send/it-"
        + UNIQUE.incrementAndGet()
        + "-"
        + System.nanoTime();
  }

  private static RequestPostProcessor as(String subject, String scope) {
    return jwt()
        .jwt(b -> b.subject(subject).claim("email", subject + "@example.com"))
        .authorities(new SimpleGrantedAuthority(scope));
  }

  private static RequestPostProcessor as(String subject) {
    return as(subject, "SCOPE_todo:api");
  }

  private MockHttpServletRequestBuilder body(
      MockHttpServletRequestBuilder request, Object payload) {
    return request
        .contentType(MediaType.APPLICATION_JSON)
        .content(json.writeValueAsString(payload));
  }

  private void critical(String who, String title) throws Exception {
    mvc.perform(
            body(
                post("/api/tasks/capture").with(as(who)),
                Map.of("title", title, "zone", "CRITICAL_NOW")))
        .andExpect(status().isCreated());
  }

  private void register(String who, String endpoint) throws Exception {
    mvc.perform(
            body(
                put("/api/push/subscription").with(as(who)),
                Map.of("endpoint", endpoint, "p256dh", P256DH, "auth", AUTH)))
        .andExpect(status().isNoContent());
  }

  @Test
  @DisplayName("the app learns the key a device subscribes with")
  void offersTheKey() throws Exception {
    mvc.perform(get("/api/push/key").with(as(someone())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.publicKey").value("test-public-key"));
  }

  @Test
  @DisplayName("a device that registers is sent its user's Critical Now straight away")
  void welcomesADevice() throws Exception {
    String me = someone();
    critical(me, "Call the plumber");
    String endpoint = anEndpoint();

    register(me, endpoint);

    await().until(() -> !pushes.sentTo(endpoint).isEmpty());
    assertThat(pushes.sentTo(endpoint).getFirst()).contains("Call the plumber");
    assertThat(stored(endpoint)).isPresent();
  }

  @Test
  @DisplayName("registering again sends it again: the way a dismissed notification comes back")
  void registeringAgainResends() throws Exception {
    String me = someone();
    String endpoint = anEndpoint();
    register(me, endpoint);
    await().until(() -> pushes.sentTo(endpoint).size() == 1);

    register(me, endpoint);

    await().until(() -> pushes.sentTo(endpoint).size() == 2);
  }

  @Test
  @DisplayName("a device registered by someone else is theirs now, and shows their Critical Now")
  void aDeviceChangesHands() throws Exception {
    String before = someone();
    String after = someone();
    critical(before, "Before's secret");
    critical(after, "After's errand");
    String endpoint = anEndpoint();
    register(before, endpoint);
    await().until(() -> pushes.sentTo(endpoint).size() == 1);

    register(after, endpoint);

    await().until(() -> pushes.sentTo(endpoint).size() == 2);
    assertThat(pushes.sentTo(endpoint).getLast())
        .contains("After's errand")
        .doesNotContain("Before's secret");
    assertThat(stored(endpoint))
        .hasValueSatisfying(s -> assertThat(s.user().externalId()).isEqualTo(after));
  }

  @Test
  @DisplayName("someone else's device is not taken over by its endpoint alone, and nothing is said")
  void anEndpointAloneTakesNothingOver() throws Exception {
    String owner = someone();
    String endpoint = anEndpoint();
    register(owner, endpoint);

    mvc.perform(
            body(
                put("/api/push/subscription").with(as(someone())),
                Map.of("endpoint", endpoint, "p256dh", P256DH, "auth", "AAAAAAAAAAAAAAAAAAAAAA")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("No such device"));

    assertThat(stored(endpoint))
        .hasValueSatisfying(s -> assertThat(s.user().externalId()).isEqualTo(owner));
  }

  @Test
  @DisplayName("its owner may register a device again with new keys")
  void theOwnerRenewsTheKeys() throws Exception {
    String me = someone();
    String endpoint = anEndpoint();
    register(me, endpoint);

    mvc.perform(
            body(
                put("/api/push/subscription").with(as(me)),
                Map.of("endpoint", endpoint, "p256dh", P256DH, "auth", "AAAAAAAAAAAAAAAAAAAAAA")))
        .andExpect(status().isNoContent());

    assertThat(stored(endpoint)).hasValueSatisfying(s -> assertThat(s.auth()).startsWith("AAAA"));
  }

  @Test
  @DisplayName("an endpoint that is no push service is refused, and nothing is stored or sent")
  void refusesAForeignEndpoint() throws Exception {
    String endpoint = "https://internal.example/hook-" + System.nanoTime();

    mvc.perform(
            body(
                put("/api/push/subscription").with(as(someone())),
                Map.of("endpoint", endpoint, "p256dh", P256DH, "auth", AUTH)))
        .andExpect(status().isBadRequest());

    assertThat(stored(endpoint)).isEmpty();
    assertThat(pushes.sentTo(endpoint)).isEmpty();
  }

  @Test
  @DisplayName("an MCP token opens neither the key nor registration, and the refusal is empty")
  void mcpTokenIsRefused() throws Exception {
    String endpoint = anEndpoint();
    String who = someone();

    mvc.perform(get("/api/push/key").with(as(who, "SCOPE_todo:mcp")))
        .andExpect(status().isForbidden())
        .andExpect(content().string(""));
    mvc.perform(
            body(
                put("/api/push/subscription").with(as(who, "SCOPE_todo:mcp")),
                Map.of("endpoint", endpoint, "p256dh", P256DH, "auth", AUTH)))
        .andExpect(status().isForbidden())
        .andExpect(content().string(""));

    assertThat(stored(endpoint)).isEmpty();
  }

  private org.springframework.test.web.servlet.ResultActions removal(String endpoint, String auth)
      throws Exception {
    return mvc.perform(body(post("/push/removal"), Map.of("endpoint", endpoint, "auth", auth)));
  }

  @Test
  @DisplayName("a signed-out device removes itself with its own secret, and needs no token for it")
  void removesWithoutAToken() throws Exception {
    String endpoint = anEndpoint();
    register(someone(), endpoint);

    removal(endpoint, AUTH).andExpect(status().isNoContent()).andExpect(content().string(""));

    assertThat(stored(endpoint)).isEmpty();
  }

  @Test
  @DisplayName("the wrong secret removes nothing, and is answered exactly like the right one")
  void theWrongSecretRemovesNothing() throws Exception {
    String endpoint = anEndpoint();
    register(someone(), endpoint);

    removal(endpoint, "c29tZXRoaW5nIGVsc2U")
        .andExpect(status().isNoContent())
        .andExpect(content().string(""));
    removal(anEndpoint(), AUTH).andExpect(status().isNoContent()).andExpect(content().string(""));

    assertThat(stored(endpoint)).isPresent();
  }
}
