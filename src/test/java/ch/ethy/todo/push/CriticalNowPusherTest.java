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
import ch.ethy.todo.service.BoardChanges;
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
import java.util.Set;
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

  static {
    ReflectionTestUtils.setField(ME, "id", 1L);
  }

  private static final Board BOARD =
      new Board(
          List.of(new Task("Pay rent", TaskZone.CRITICAL_NOW, NOW)),
          Map.of(),
          LocalDate.of(2026, 11, 19));
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
  private TaskService tasks;
  private CriticalNowPusher pusher;

  @BeforeEach
  void pusher() {
    PushSubscription device = new PushSubscription(ME, "https://push.example/1", "key", "auth");
    ReflectionTestUtils.setField(device, "id", 1L);
    subscriptions = mock(PushSubscriptionRepository.class);
    when(subscriptions.findWithUser(1L)).thenReturn(Optional.of(device));

    tasks = mock(TaskService.class);
    when(tasks.board(eq(ME), any(BoardFilter.class))).thenReturn(BOARD);

    pusher = new CriticalNowPusher(subscriptions, tasks, gateway, executor, RETRIES, RETRIES);
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
  @DisplayName(
      "a push the service could not take is tried a few times more, then left for the next change")
  void failuresAreRetriedAFewTimes() throws InterruptedException {
    gateway.answers.addAll(
        List.of(
            PushGateway.Outcome.FAILED, PushGateway.Outcome.FAILED, PushGateway.Outcome.FAILED));

    pusher.welcome(1L);

    await().until(() -> gateway.sent.size() == 3);
    Thread.sleep(100);
    assertThat(gateway.sent).hasSize(3);
    verify(subscriptions, never()).recordSent(any(), any());
    verify(subscriptions, never()).deleteById(any());
  }

  @Test
  @DisplayName("a failed push after a change is tried again, and recorded once it gets through")
  void aFailedChangeIsRetried() {
    when(subscriptions.findAffected(any(), any())).thenReturn(List.of(device(1L, ME, null)));
    gateway.answers.add(PushGateway.Outcome.FAILED);

    pusher.boardsChanged(new BoardChanges.Changed(Set.of(1L), Set.of()));

    await().until(() -> gateway.sent.size() == 2);
    verify(subscriptions, org.mockito.Mockito.timeout(1000)).recordSent(eq(1L), anyString());
  }

  @Test
  @DisplayName("one device's trouble does not cost the devices after it the change")
  void oneDeviceDoesNotStopTheRest() {
    User other = new User("other", "other@example.com", "Other");
    ReflectionTestUtils.setField(other, "id", 2L);
    when(tasks.board(eq(other), any(BoardFilter.class))).thenThrow(new IllegalStateException("db"));
    when(subscriptions.findAffected(any(), any()))
        .thenReturn(List.of(device(10L, other, null), device(11L, ME, null)));

    pusher.boardsChanged(new BoardChanges.Changed(Set.of(1L), Set.of()));

    verify(subscriptions, org.mockito.Mockito.timeout(1000)).recordSent(eq(11L), anyString());
  }

  private PushSubscription device(long id, User user, String lastSent) {
    PushSubscription device =
        new PushSubscription(user, "https://push.example/" + id, "key", "auth");
    ReflectionTestUtils.setField(device, "id", id);
    ReflectionTestUtils.setField(device, "lastSent", lastSent);
    return device;
  }

  private static String digestOf(String payload) {
    return CriticalNowPusher.digest(payload.getBytes(StandardCharsets.UTF_8));
  }

  @Test
  @DisplayName(
      "after a change, a device is sent its Critical Now only when it would say something new")
  void sendsOnlyWhatChanged() {
    String current = new String(CriticalNowNotice.of(BOARD).payload(), StandardCharsets.UTF_8);
    when(subscriptions.findAffected(any(), any()))
        .thenReturn(
            List.of(device(10L, ME, digestOf(current)), device(11L, ME, "something older")));

    pusher.boardsChanged(new BoardChanges.Changed(Set.of(1L), Set.of()));

    await().until(() -> gateway.sent.size() == 1);
    verify(subscriptions, org.mockito.Mockito.timeout(1000)).recordSent(11L, digestOf(current));
    verify(subscriptions, never()).recordSent(eq(10L), any());
  }

  @Test
  @DisplayName("a board is read once per person, however many devices they have")
  void readsEachBoardOnce() {
    when(subscriptions.findAffected(any(), any()))
        .thenReturn(List.of(device(10L, ME, null), device(11L, ME, null)));

    pusher.boardsChanged(new BoardChanges.Changed(Set.of(1L), Set.of()));

    await().until(() -> gateway.sent.size() == 2);
    verify(tasks, org.mockito.Mockito.times(1)).board(eq(ME), any(BoardFilter.class));
  }

  @Test
  @DisplayName("at midnight every device is looked at, and sent what changed with the day")
  void looksAtEveryDevice() {
    String current = new String(CriticalNowNotice.of(BOARD).payload(), StandardCharsets.UTF_8);
    when(subscriptions.findAllWithUser())
        .thenReturn(List.of(device(10L, ME, digestOf(current)), device(11L, ME, "yesterday's")));

    pusher.refreshAll();

    await().until(() -> gateway.sent.size() == 1);
    verify(subscriptions, org.mockito.Mockito.timeout(1000)).recordSent(11L, digestOf(current));
  }

  @Test
  @DisplayName("a device the push service no longer knows is forgotten after a change")
  void forgetsAGoneDevice() {
    when(subscriptions.findAffected(any(), any())).thenReturn(List.of(device(10L, ME, null)));
    gateway.answers.add(PushGateway.Outcome.GONE);

    pusher.boardsChanged(new BoardChanges.Changed(Set.of(1L), Set.of()));

    verify(subscriptions, org.mockito.Mockito.timeout(1000)).deleteById(10L);
  }

  @Test
  @DisplayName("a change that named nobody asks the database nothing")
  void nothingToDo() throws InterruptedException {
    pusher.boardsChanged(new BoardChanges.Changed(Set.of(), Set.of()));

    Thread.sleep(50);
    verify(subscriptions, never()).findAffected(any(), any());
  }

  @Test
  @DisplayName("a server without keys sends nothing, so it reads neither devices nor boards")
  void nothingToDoWithoutKeys() throws InterruptedException {
    var off =
        new CriticalNowPusher(subscriptions, tasks, PushGateway.OFF, executor, RETRIES, RETRIES);

    off.boardsChanged(new BoardChanges.Changed(Set.of(1L), Set.of()));
    off.refreshAll();

    Thread.sleep(50);
    verify(subscriptions, never()).findAffected(any(), any());
    verify(subscriptions, never()).findAllWithUser();
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
