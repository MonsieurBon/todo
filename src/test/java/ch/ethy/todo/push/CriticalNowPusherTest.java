package ch.ethy.todo.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.ethy.todo.domain.PushSubscription;
import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.PushSubscriptionRepository;
import ch.ethy.todo.service.Board;
import ch.ethy.todo.service.BoardFilter;
import ch.ethy.todo.service.TaskService;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Queue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class CriticalNowPusherTest {

  private static final Instant NOW = Instant.parse("2026-11-19T10:00:00Z");
  private static final User ME = new User("subject", "me@example.com", "Me");
  private static final List<Duration> RETRIES =
      List.of(Duration.ofMillis(10), Duration.ofMillis(20));

  /** Answers in the order given, then DELIVERED; records what it was handed. */
  private static final class ScriptedGateway implements PushGateway {
    final Queue<Outcome> answers = new ArrayDeque<>();
    final List<String> sent = new CopyOnWriteArrayList<>();

    @Override
    public Optional<String> publicKey() {
      return Optional.of("key");
    }

    @Override
    public synchronized Outcome send(PushSubscription subscription, byte[] payload) {
      sent.add(new String(payload, StandardCharsets.UTF_8));
      Outcome next = answers.poll();
      return next == null ? Outcome.DELIVERED : next;
    }
  }

  private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
  private final ScriptedGateway gateway = new ScriptedGateway();
  private PushSubscriptionRepository subscriptions;
  private CriticalNowPusher pusher;

  @BeforeEach
  void pusher() {
    PushSubscription device = new PushSubscription(ME, "https://push.example/1", "key", "auth");
    ReflectionTestUtils.setField(device, "id", 1L);
    subscriptions = mock(PushSubscriptionRepository.class);
    when(subscriptions.findWithUser(1L)).thenReturn(Optional.of(device));

    TaskService tasks = mock(TaskService.class);
    when(tasks.board(eq(ME), any(BoardFilter.class)))
        .thenReturn(
            new Board(
                List.of(new Task("Pay rent", TaskZone.CRITICAL_NOW, NOW)),
                Map.of(),
                LocalDate.of(2026, 11, 19)));

    pusher = new CriticalNowPusher(subscriptions, tasks, gateway, executor, RETRIES);
  }

  @AfterEach
  void stop() {
    executor.shutdownNow();
  }

  @Test
  @DisplayName("a device that registers is sent its Critical Now, and that is remembered")
  void welcomesADevice() {
    pusher.welcome(1L);

    await().until(() -> gateway.sent.size() == 1);
    assertThat(gateway.sent.getFirst()).contains("Pay rent");
    verify(subscriptions, org.mockito.Mockito.timeout(1000)).recordSent(eq(1L), anyString());
  }

  @Test
  @DisplayName("a gone answer right after registering is tried again: a new device takes a moment")
  void retriesAFreshDevice() {
    gateway.answers.add(PushGateway.Outcome.GONE);

    pusher.welcome(1L);

    await().until(() -> gateway.sent.size() == 2);
    verify(subscriptions, org.mockito.Mockito.timeout(1000)).recordSent(eq(1L), anyString());
    verify(subscriptions, never()).deleteById(any());
  }

  @Test
  @DisplayName("still gone after every retry, the device is left registered and nothing recorded")
  void givesUpQuietly() throws InterruptedException {
    gateway.answers.addAll(
        List.of(PushGateway.Outcome.GONE, PushGateway.Outcome.GONE, PushGateway.Outcome.GONE));

    pusher.welcome(1L);

    await().until(() -> gateway.sent.size() == 3);
    Thread.sleep(50);
    assertThat(gateway.sent).hasSize(3);
    verify(subscriptions, never()).recordSent(any(), any());
    verify(subscriptions, never()).deleteById(any());
  }

  @Test
  @DisplayName("a failure is not retried here: the next change sends again")
  void failureWaitsForTheNextChange() throws InterruptedException {
    gateway.answers.add(PushGateway.Outcome.FAILED);

    pusher.welcome(1L);

    await().until(() -> gateway.sent.size() == 1);
    Thread.sleep(50);
    assertThat(gateway.sent).hasSize(1);
    verify(subscriptions, never()).recordSent(any(), any());
  }

  @Test
  @DisplayName("a device that went away in the meantime is skipped")
  void skipsAMissingDevice() throws InterruptedException {
    when(subscriptions.findWithUser(2L)).thenReturn(Optional.empty());

    pusher.welcome(2L);

    Thread.sleep(50);
    assertThat(gateway.sent).isEmpty();
  }
}
