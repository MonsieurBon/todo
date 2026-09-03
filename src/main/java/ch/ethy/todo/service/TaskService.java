package ch.ethy.todo.service;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
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

  /** Every task the user can see, narrowed by the filter. The default view of the app. */
  @Transactional(readOnly = true)
  public List<Task> board(User user, BoardFilter filter) {
    return tasks.findOnBoard(
        user,
        LocalDate.now(clock),
        filter.listId(),
        filter.label(),
        filter.zone(),
        filter.includeDone());
  }

  /**
   * How full each zone is across the filtered view, and whether that is over what the method says
   * it should hold.
   *
   * <p>Counted across everything visible rather than per list. A cap counted per list would be
   * enforced once per list, so five topic-shaped lists would permit twenty-five Critical Now tasks
   * with every list reporting itself healthy — which removes the only thing the cap is for.
   */
  @Transactional(readOnly = true)
  public Map<TaskZone, Long> zoneLoads(User user, BoardFilter filter) {
    Map<TaskZone, Long> counts =
        tasks
            .countOpenByZoneOnBoard(user, LocalDate.now(clock), filter.listId(), filter.label())
            .stream()
            .collect(Collectors.toMap(row -> (TaskZone) row[0], row -> (Long) row[1]));
    return java.util.Arrays.stream(TaskZone.values())
        .collect(Collectors.toMap(zone -> zone, zone -> counts.getOrDefault(zone, 0L)));
  }

  /** Every topic in use across the tasks this user can see. */
  @Transactional(readOnly = true)
  public List<String> labelsVisibleTo(User user) {
    return tasks.findLabelsVisibleTo(user);
  }

  public Task setLabels(Long id, User user, java.util.Collection<String> labels) {
    Task task = accessible(id, user);
    task.labels(labels);
    return task;
  }

  /** Creates a task in a named list. */
  public Task addTo(Long listId, User user, NewTask draft) {
    return createIn(lists.accessible(listId, user), draft);
  }

  /**
   * Files a task without naming a list. This is the capture path: it needs no read scope, so it
   * works both for a client that cannot discover a list and for a quick capture from the web app.
   */
  public Task capture(User user, NewTask draft) {
    return createIn(lists.inboxOf(user), draft);
  }

  /**
   * Creates a task, unless the caller's reference says it already exists.
   *
   * <p>The web app queues captures made offline and replays them on reconnect, where a lost
   * response is indistinguishable from a lost request. Matching the caller's own reference turns
   * the replay into a lookup, so a create is safe to repeat. Everything else passes {@code null}
   * and always creates.
   */
  private Task createIn(TaskList list, NewTask draft) {
    String clientRef = draft.clientRef();
    if (clientRef != null && !clientRef.isBlank()) {
      var existing = tasks.findByTaskListAndClientRef(list, clientRef.trim());
      if (existing.isPresent()) {
        return existing.get();
      }
    }
    Task task = new Task(draft.title(), draft.zone());
    task.clientRef(clientRef);
    task.notes(draft.notes());
    task.dueDate(draft.dueDate());
    task.labels(draft.labels());
    list.add(task);
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

  /**
   * The same sweep across everything the user can see, narrowed by the board's own filters.
   *
   * <p>The per-list sweep above predates the board. Now that urgency is counted across every list,
   * reviewing one list at a time would leave the caps meaning one thing and the sweep another.
   */
  @Transactional(readOnly = true)
  public List<Task> reviewQueue(User user, BoardFilter filter) {
    return board(user, filter).stream().filter(t -> t.isReviewDue(clock.instant())).toList();
  }
}
