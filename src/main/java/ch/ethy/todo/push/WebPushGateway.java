package ch.ethy.todo.push;

import ch.ethy.todo.domain.PushSubscription;
import java.time.Clock;
import java.util.Base64;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Web Push as RFC 8030 sends it, with a VAPID token (RFC 8292) and an RFC 8291 payload. */
class WebPushGateway implements PushGateway {

  private static final Logger log = LoggerFactory.getLogger(WebPushGateway.class);

  /** A day: a phone that comes back after that is sent the current state on the next change. */
  private static final String TTL = "86400";

  /** One topic for every push, so a push service holding one back replaces it with the next. */
  private static final String TOPIC = "critical-now";

  private final Vapid vapid;
  private final RestClient http;
  private final Clock clock;

  WebPushGateway(Vapid vapid, RestClient http, Clock clock) {
    this.vapid = vapid;
    this.http = http;
    this.clock = clock;
  }

  @Override
  public Optional<String> publicKey() {
    return Optional.of(vapid.publicKey());
  }

  @Override
  public Outcome send(PushSubscription subscription, byte[] payload) {
    byte[] body =
        WebPushEncryption.encrypt(
            payload,
            P256.publicKey(Base64.getUrlDecoder().decode(subscription.p256dh())),
            Base64.getUrlDecoder().decode(subscription.auth()));
    try {
      int status =
          http.post()
              .uri(java.net.URI.create(subscription.endpoint()))
              .header(
                  "Authorization", vapid.authorization(subscription.endpoint(), clock.instant()))
              .header("Content-Encoding", "aes128gcm")
              .header("TTL", TTL)
              .header("Topic", TOPIC)
              .contentType(MediaType.APPLICATION_OCTET_STREAM)
              .body(body)
              .exchange((request, response) -> response.getStatusCode().value(), true);
      return outcome(subscription, status);
    } catch (RestClientException e) {
      // Not the message: it quotes the endpoint, which is as good as the device's address.
      log.warn(
          "Push to subscription {} failed: {}",
          subscription.id(),
          e.getMostSpecificCause().getClass().getSimpleName());
      return Outcome.FAILED;
    }
  }

  private static Outcome outcome(PushSubscription subscription, int status) {
    if (status >= 200 && status < 300) {
      return Outcome.DELIVERED;
    }
    if (status == 404 || status == 410) {
      return Outcome.GONE;
    }
    log.warn("Push service refused subscription {} with {}", subscription.id(), status);
    return Outcome.FAILED;
  }
}
