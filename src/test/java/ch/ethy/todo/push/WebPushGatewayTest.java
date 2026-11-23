package ch.ethy.todo.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

import ch.ethy.todo.domain.PushSubscription;
import ch.ethy.todo.domain.User;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class WebPushGatewayTest {

  private static final String PUBLIC_KEY =
      "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
  private static final String PRIVATE_KEY = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
  private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-1";
  private static final PushSubscription DEVICE =
      new PushSubscription(
          new User("subject", "me@example.com", "Me"),
          ENDPOINT,
          "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
          "BTBZMqHH6r4Tts7J_aSIgg");

  private MockRestServiceServer server;
  private WebPushGateway gateway;

  @BeforeEach
  void gateway() {
    RestClient.Builder rest = RestClient.builder();
    server = MockRestServiceServer.bindTo(rest).build();
    gateway =
        new WebPushGateway(
            new Vapid(PUBLIC_KEY, PRIVATE_KEY, "https://todo.example.com"),
            rest.build(),
            Clock.fixed(Instant.parse("2026-11-19T10:00:00Z"), ZoneOffset.UTC));
  }

  @Test
  @DisplayName("posts the encrypted payload as RFC 8030 asks, replacing anything still queued")
  void postsTheMessage() {
    server
        .expect(requestTo(ENDPOINT))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header("Content-Encoding", "aes128gcm"))
        .andExpect(header("Content-Type", "application/octet-stream"))
        .andExpect(header("TTL", "86400"))
        .andExpect(header("Topic", "critical-now"))
        .andExpect(header("Authorization", Matchers.startsWith("vapid t=")))
        .andExpect(header("Authorization", Matchers.endsWith(", k=" + PUBLIC_KEY)))
        .andRespond(withStatus(HttpStatus.CREATED));

    assertThat(gateway.send(DEVICE, "{}".getBytes())).isEqualTo(PushGateway.Outcome.DELIVERED);
    server.verify();
  }

  @ParameterizedTest(name = "{0} means {1}")
  @CsvSource({
    "200, DELIVERED",
    "202, DELIVERED",
    "404, GONE",
    "410, GONE",
    "400, FAILED",
    "403, FAILED",
    "413, FAILED",
    "429, FAILED",
    "503, FAILED"
  })
  @DisplayName("reads the push service's answer")
  void readsTheAnswer(int status, PushGateway.Outcome outcome) {
    server.expect(requestTo(ENDPOINT)).andRespond(withStatus(HttpStatus.valueOf(status)));

    assertThat(gateway.send(DEVICE, "{}".getBytes())).isEqualTo(outcome);
  }

  @Test
  @DisplayName("a push service that cannot be reached is a failure, not a gone device")
  void unreachableIsAFailure() {
    server.expect(requestTo(ENDPOINT)).andRespond(withException(new IOException("refused")));

    assertThat(gateway.send(DEVICE, "{}".getBytes())).isEqualTo(PushGateway.Outcome.FAILED);
  }

  @Test
  @DisplayName("offers the public key devices subscribe with")
  void offersTheKey() {
    assertThat(gateway.publicKey()).contains(PUBLIC_KEY);
  }
}
