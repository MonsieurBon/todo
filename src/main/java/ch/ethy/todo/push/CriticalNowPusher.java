package ch.ethy.todo.push;

import ch.ethy.todo.domain.PushSubscription;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.repository.PushSubscriptionRepository;
import ch.ethy.todo.service.BoardFilter;
import ch.ethy.todo.service.TaskService;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Works out what each device's notification should say and sends it.
 *
 * <p>Everything runs on one thread, in the order it was asked for after its write committed: each
 * read therefore sees every earlier write, and the last push to leave carries the newest board.
 */
public class CriticalNowPusher implements AutoCloseable {

  private static final Logger log = LoggerFactory.getLogger(CriticalNowPusher.class);

  private static final BoardFilter CRITICAL_NOW =
      new BoardFilter(null, null, TaskZone.CRITICAL_NOW, false, false);

  private final PushSubscriptionRepository subscriptions;
  private final TaskService tasks;
  private final PushGateway gateway;
  private final ScheduledExecutorService executor;
  private final List<Duration> retries;

  /**
   * @param retries how long to wait before asking again when a device has only just registered: a
   *     push service can call a brand-new subscription gone for a moment
   */
  CriticalNowPusher(
      PushSubscriptionRepository subscriptions,
      TaskService tasks,
      PushGateway gateway,
      ScheduledExecutorService executor,
      List<Duration> retries) {
    this.subscriptions = subscriptions;
    this.tasks = tasks;
    this.gateway = gateway;
    this.executor = executor;
    this.retries = List.copyOf(retries);
  }

  /**
   * Sends the device its Critical Now whatever it showed before: registering is also how a
   * notification someone swiped away comes back.
   */
  public void welcome(Long subscriptionId) {
    executor.execute(() -> welcome(subscriptionId, 0));
  }

  private void welcome(Long subscriptionId, int attempt) {
    try {
      subscriptions
          .findWithUser(subscriptionId)
          .ifPresent(
              device -> {
                if (send(device) == PushGateway.Outcome.GONE && attempt < retries.size()) {
                  executor.schedule(
                      () -> welcome(subscriptionId, attempt + 1),
                      retries.get(attempt).toMillis(),
                      TimeUnit.MILLISECONDS);
                }
              });
    } catch (RuntimeException e) {
      // One device's trouble must not stop the thread every other device's pushes run on.
      log.warn("Could not push to subscription {}", subscriptionId, e);
    }
  }

  private PushGateway.Outcome send(PushSubscription device) {
    byte[] payload = CriticalNowNotice.of(tasks.board(device.user(), CRITICAL_NOW)).payload();
    PushGateway.Outcome outcome = gateway.send(device, payload);
    if (outcome == PushGateway.Outcome.DELIVERED) {
      subscriptions.recordSent(device.id(), digest(payload));
    }
    return outcome;
  }

  @Override
  public void close() {
    executor.shutdownNow();
  }

  static String digest(byte[] payload) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("The JDK has no SHA-256", e);
    }
  }
}
