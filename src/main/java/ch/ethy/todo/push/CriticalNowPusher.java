package ch.ethy.todo.push;

import ch.ethy.todo.domain.PushSubscription;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.repository.PushSubscriptionRepository;
import ch.ethy.todo.service.BoardChanges;
import ch.ethy.todo.service.BoardFilter;
import ch.ethy.todo.service.TaskService;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;

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
  private final List<Duration> welcomeRetries;
  private final List<Duration> failureRetries;

  /**
   * @param welcomeRetries how long to wait before asking again when a device has only just
   *     registered: a push service can call a brand-new subscription gone for a moment
   * @param failureRetries how long to wait before trying again after a push service could not take
   *     a push, so that a lost one does not leave a device showing the wrong tasks for hours
   */
  CriticalNowPusher(
      PushSubscriptionRepository subscriptions,
      TaskService tasks,
      PushGateway gateway,
      ScheduledExecutorService executor,
      List<Duration> welcomeRetries,
      List<Duration> failureRetries) {
    this.subscriptions = subscriptions;
    this.tasks = tasks;
    this.gateway = gateway;
    this.executor = executor;
    this.welcomeRetries = List.copyOf(welcomeRetries);
    this.failureRetries = List.copyOf(failureRetries);
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
                switch (send(device, payloadFor(device))) {
                  case GONE -> {
                    if (attempt < welcomeRetries.size()) {
                      later(
                          welcomeRetries.get(attempt), () -> welcome(subscriptionId, attempt + 1));
                    }
                  }
                  case FAILED -> retryLater(subscriptionId, 0);
                  case DELIVERED -> {}
                }
              });
    } catch (RuntimeException e) {
      // One device's trouble must not stop the thread every other device's pushes run on.
      log.warn("Could not push to subscription {}", subscriptionId, e);
    }
  }

  /** After a write has committed: each device whose notification would now say something else. */
  @EventListener
  public void boardsChanged(BoardChanges.Changed changed) {
    if (!sending() || (changed.listIds().isEmpty() && changed.userIds().isEmpty())) {
      return;
    }
    executor.execute(() -> refresh(changed));
  }

  /** Every device: what a day's end changes is not a write anyone made. */
  public void refreshAll() {
    if (!sending()) {
      return;
    }
    executor.execute(() -> refresh(subscriptions::findAllWithUser));
  }

  /** Without keys every push would fail, and rows left from when there were keys would retry it. */
  private boolean sending() {
    return gateway.publicKey().isPresent();
  }

  private void refresh(BoardChanges.Changed changed) {
    refresh(() -> subscriptions.findAffected(orNone(changed.listIds()), orNone(changed.userIds())));
  }

  private void refresh(Supplier<List<PushSubscription>> devices) {
    List<PushSubscription> found;
    try {
      found = devices.get();
    } catch (RuntimeException e) {
      log.warn("Could not read which devices to push to", e);
      return;
    }
    Map<Long, byte[]> payloads = new HashMap<>();
    for (PushSubscription device : found) {
      try {
        update(device, payloads.computeIfAbsent(device.user().id(), id -> payloadFor(device)), 0);
      } catch (RuntimeException e) {
        // One device's trouble must not cost every device after it this change.
        log.warn("Could not push to subscription {}", device.id(), e);
      }
    }
  }

  /** Sends only what the device does not show yet. */
  private void update(PushSubscription device, byte[] payload, int failures) {
    if (digest(payload).equals(device.lastSent())) {
      return;
    }
    switch (send(device, payload)) {
      // A welcome waits a moment instead, since a push service can call a brand-new subscription
      // gone; by the time something changes, it has had that moment.
      case GONE -> subscriptions.deleteById(device.id());
      case FAILED -> retryLater(device.id(), failures);
      case DELIVERED -> {}
    }
  }

  private void retryLater(Long subscriptionId, int failures) {
    if (failures < failureRetries.size()) {
      later(failureRetries.get(failures), () -> retry(subscriptionId, failures + 1));
    }
  }

  /** Reads the board again, so a change made in the meantime is what is sent. */
  private void retry(Long subscriptionId, int failures) {
    try {
      subscriptions
          .findWithUser(subscriptionId)
          .ifPresent(device -> update(device, payloadFor(device), failures));
    } catch (RuntimeException e) {
      log.warn("Could not push to subscription {}", subscriptionId, e);
    }
  }

  private void later(Duration delay, Runnable work) {
    executor.schedule(work, delay.toMillis(), TimeUnit.MILLISECONDS);
  }

  /** An empty {@code in} is not something every database takes; no id is ever negative. */
  private static Collection<Long> orNone(Set<Long> ids) {
    return ids.isEmpty() ? List.of(-1L) : ids;
  }

  private byte[] payloadFor(PushSubscription device) {
    return CriticalNowNotice.of(tasks.board(device.user(), CRITICAL_NOW)).payload();
  }

  private PushGateway.Outcome send(PushSubscription device, byte[] payload) {
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
