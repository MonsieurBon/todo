package ch.ethy.todo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.TaskRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** Which deferred tasks the board shows and counts, around the day a deferral ends. */
class TaskServiceTest {

  private static final Instant NOW = Instant.parse("2026-09-03T10:00:00Z");
  private static final LocalDate TODAY = LocalDate.of(2026, 9, 3);
  private static final User ME = new User("idp-subject", "me@example.com", "Me");

  private TaskRepository tasks;
  private TaskService service;

  private static Task deferredUntil(String title, LocalDate until) {
    Task task = new Task(title, TaskZone.CRITICAL_NOW, NOW);
    task.deferUntil(until, until.minusDays(1), NOW);
    return task;
  }

  @BeforeEach
  void board() {
    tasks = mock(TaskRepository.class);
    when(tasks.findOnBoard(any(), any(), any(), anyBoolean()))
        .thenReturn(
            List.of(
                new Task("Never deferred", TaskZone.CRITICAL_NOW, NOW),
                deferredUntil("Back yesterday", TODAY.minusDays(1)),
                deferredUntil("Back today", TODAY),
                deferredUntil("Back tomorrow", TODAY.plusDays(1))));
    service = new TaskService(tasks, mock(TaskListService.class), Clock.fixed(NOW, ZoneOffset.UTC));
  }

  @Test
  @DisplayName("a task is back on the board on the day its deferral ends")
  void hidesUntilTheDay() {
    assertThat(service.board(ME, BoardFilter.everything()).tasks())
        .extracting(Task::title)
        .containsExactly("Never deferred", "Back yesterday", "Back today");
  }

  @Test
  @DisplayName("asked for, the board shows a task still deferred too")
  void showsDeferredOnRequest() {
    var withDeferred = new BoardFilter(null, null, null, false, true);

    assertThat(service.board(ME, withDeferred).tasks())
        .extracting(Task::title)
        .containsExactly("Never deferred", "Back yesterday", "Back today", "Back tomorrow");
  }

  @Test
  @DisplayName("a task still deferred counts towards no zone, shown or not; one back today does")
  void countsWhatIsBack() {
    var withDeferred = new BoardFilter(null, null, null, false, true);

    assertThat(service.board(ME, BoardFilter.everything()).loads())
        .containsEntry(TaskZone.CRITICAL_NOW, 3L);
    assertThat(service.board(ME, withDeferred).loads()).containsEntry(TaskZone.CRITICAL_NOW, 3L);
  }

  @Test
  @DisplayName("a completed task shown on request counts towards no zone")
  void completedIsNoLoad() {
    Task done = new Task("Done already", TaskZone.CRITICAL_NOW, NOW);
    done.complete();
    when(tasks.findOnBoard(any(), any(), any(), anyBoolean())).thenReturn(List.of(done));

    var board = service.board(ME, new BoardFilter(null, null, null, true, false));

    assertThat(board.tasks()).containsExactly(done);
    assertThat(board.loads()).containsEntry(TaskZone.CRITICAL_NOW, 0L);
  }

  @Test
  @DisplayName("the board and its loads come from one read, narrowed to a zone or not")
  void oneRead() {
    var oneZone = new BoardFilter(null, null, TaskZone.OPPORTUNITY_NOW, false, false);

    var board = service.board(ME, oneZone);

    assertThat(board.tasks()).isEmpty();
    assertThat(board.loads()).containsEntry(TaskZone.CRITICAL_NOW, 3L);
    verify(tasks, times(1)).findOnBoard(any(), any(), any(), anyBoolean());
  }

  @Test
  @DisplayName("narrowed to a list or a topic, the loads still count everything visible")
  void loadsIgnoreTheNarrowing() {
    Task inTopic = new Task("In the topic", TaskZone.CRITICAL_NOW, NOW);
    when(tasks.findOnBoard(ME, 7L, "house", false)).thenReturn(List.of(inTopic));

    var board = service.board(ME, new BoardFilter(7L, "house", null, false, false));

    assertThat(board.tasks()).containsExactly(inTopic);
    assertThat(board.loads()).containsEntry(TaskZone.CRITICAL_NOW, 3L);
  }

  /** Whatever maps the tasks must use the day they were sorted by, or a midnight splits them. */
  @Test
  @DisplayName("the board says which day it decided by")
  void saysItsDay() {
    assertThat(service.board(ME, BoardFilter.everything()).today()).isEqualTo(TODAY);
  }
}
