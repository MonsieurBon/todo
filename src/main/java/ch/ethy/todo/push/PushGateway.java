package ch.ethy.todo.push;

import ch.ethy.todo.domain.PushSubscription;
import java.util.Optional;

/** Hands a payload to the push service that serves a device. */
public interface PushGateway {

  enum Outcome {
    DELIVERED,
    /** The push service no longer knows the device. */
    GONE,
    /** Anything else: worth trying again with the next change. */
    FAILED
  }

  /** The key devices subscribe with; empty when this server has no keys and so sends nothing. */
  Optional<String> publicKey();

  Outcome send(PushSubscription subscription, byte[] payload);

  PushGateway OFF =
      new PushGateway() {
        @Override
        public Optional<String> publicKey() {
          return Optional.empty();
        }

        @Override
        public Outcome send(PushSubscription subscription, byte[] payload) {
          return Outcome.FAILED;
        }
      };
}
