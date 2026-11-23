package ch.ethy.todo;

import ch.ethy.todo.domain.PushSubscription;
import ch.ethy.todo.push.PushGateway;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Stands in for the push services, which a test cannot reach: keeps every payload, in the clear,
 * with the endpoint it was meant for. Every test makes up its own endpoints, so none sees
 * another's.
 */
public class RecordingPushGateway implements PushGateway {

  public record Push(String endpoint, String payload) {}

  private final List<Push> pushes = new CopyOnWriteArrayList<>();

  @Override
  public Optional<String> publicKey() {
    return Optional.of("test-public-key");
  }

  @Override
  public Outcome send(PushSubscription subscription, byte[] payload) {
    pushes.add(new Push(subscription.endpoint(), new String(payload, StandardCharsets.UTF_8)));
    return Outcome.DELIVERED;
  }

  public List<String> sentTo(String endpoint) {
    return pushes.stream().filter(p -> p.endpoint().equals(endpoint)).map(Push::payload).toList();
  }
}
