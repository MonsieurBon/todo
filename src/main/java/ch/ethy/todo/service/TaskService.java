package ch.ethy.todo.service;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.TaskState;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.TaskRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Same rule as {@link TaskListService}: ids are always resolved together with the user. */
@Service
@Transactional
public class TaskService {

  private final TaskRepository tasks;
  private final TaskListService lists;
  private final Clock clock;

  public TaskService(TaskRepository tasks, TaskListService lists, Clock clock) {
    this.tasks = tasks;
    this.lists = lists;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public Task accessible(Long id, User user) {
    return tasks.findAccessible(id, user).orElseThrow(() -> new NotFoundException("No task " + id));
  }

  @Transactional(readOnly = true)
  public List<Task> visibleIn(Long listId, User user) {
    return tasks.findVisibleIn(lists.accessible(listId, user), LocalDate.now(clock));
  }

  /** How full each zone is, and whether that is over what the method says it should hold. */
  @Transactional(readOnly = true)
  public Map<TaskZone, Long> openCountsByZone(TaskList list) {
    return java.util.Arrays.stream(TaskZone.values())
        .collect(
            Collectors.toMap(
                zone -> zone,
                zone -> tasks.countByTaskListAndZoneAndState(list, zone, TaskState.TODO)));
  }

  public Task addTo(Long listId, User user, String title, TaskZone zone) {
    TaskList list = lists.accessible(listId, user);
    Task task = new Task(title, zone);
    list.add(task);
    return tasks.save(task);
  }

  /**
   * Files a task without naming a list. This is the capture-only path: such a client has no read
   * scope, so it cannot discover a list to choose.
   */
  public Task capture(User user, String title, TaskZone zone) {
    TaskList inbox = lists.inboxOf(user);
    Task task = new Task(title, zone);
    inbox.add(task);
    return tasks.save(task);
  }

  public Task complete(Long id, User user) {
    Task task = accessible(id, user);
    task.complete();
    return task;
  }

  public Task reopen(Long id, User user) {
    Task task = accessible(id, user);
    task.reopen();
    return task;
  }

  public Task moveTo(Long id, User user, TaskZone zone) {
    Task task = accessible(id, user);
    task.moveTo(zone);
    return task;
  }

  public Task defer(Long id, User user, LocalDate until) {
    Task task = accessible(id, user);
    task.deferUntil(until, LocalDate.now(clock));
    return task;
  }

  public void delete(Long id, User user) {
    Task task = accessible(id, user);
    task.taskList().remove(task);
    tasks.delete(task);
  }

  /** Marks a task as considered during a review sweep. */
  public Task markReviewed(Long id, User user) {
    Task task = accessible(id, user);
    task.markReviewed(clock.instant());
    return task;
  }

  /**
   * The tasks a review sweep should present: visible, and overdue for their zone's cadence.
   * Critical Now never appears, because it is worked continuously rather than swept.
   */
  @Transactional(readOnly = true)
  public List<Task> reviewQueue(Long listId, User user) {
    return visibleIn(listId, user).stream().filter(t -> t.isReviewDue(clock.instant())).toList();
  }
}
