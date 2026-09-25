package ch.ethy.todo.service;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.TaskRepository;
import java.text.Collator;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    return resolve(id, user);
  }

  /**
   * Mutators must not lean on {@link #accessible}: it would work from inside this bean only because
   * self-invocation misses the read-only proxy.
   */
  private Task resolve(Long id, User user) {
    return tasks.findAccessible(id, user).orElseThrow(() -> new NotFoundException("No task " + id));
  }

  @Transactional(readOnly = true)
  public List<Task> visibleIn(Long listId, User user) {
    return tasks.findVisibleIn(lists.accessible(listId, user), LocalDate.now(clock));
  }

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

  /** Sorted here because the column is compared by code point, so the database cannot. */
  @Transactional(readOnly = true)
  public List<String> labelsVisibleTo(User user) {
    Collator alphabetical = Collator.getInstance(Locale.ROOT);
    return tasks.findLabelsVisibleTo(user).stream().sorted(alphabetical).toList();
  }

  public Task setLabels(Long id, User user, java.util.Collection<String> labels) {
    Task task = resolve(id, user);
    task.labels(labels);
    return task;
  }

  public Task addTo(Long listId, User user, NewTask draft) {
    return createIn(lists.accessible(listId, user), draft);
  }

  public Task capture(User user, NewTask draft) {
    return createIn(lists.inboxOf(user), draft);
  }

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

  public Task update(Long id, User user, TaskEdit edit) {
    Task task = resolve(id, user);
    if (edit.title() != null) {
      task.title(edit.title());
    }
    if (edit.notes() != null) {
      task.notes(edit.notes());
    }
    if (edit.clearDueDate()) {
      task.dueDate(null);
    } else if (edit.dueDate() != null) {
      task.dueDate(edit.dueDate());
    }
    return task;
  }

  public Task complete(Long id, User user) {
    Task task = resolve(id, user);
    task.complete();
    return task;
  }

  public Task reopen(Long id, User user) {
    Task task = resolve(id, user);
    task.reopen();
    return task;
  }

  public Task moveTo(Long id, User user, TaskZone zone) {
    Task task = resolve(id, user);
    task.moveTo(zone);
    return task;
  }

  public Task defer(Long id, User user, LocalDate until) {
    Task task = resolve(id, user);
    task.deferUntil(until, LocalDate.now(clock));
    return task;
  }

  public void delete(Long id, User user) {
    Task task = resolve(id, user);
    task.taskList().remove(task);
    tasks.delete(task);
  }

  public Task markReviewed(Long id, User user) {
    Task task = resolve(id, user);
    task.markReviewed(clock.instant());
    return task;
  }

  @Transactional(readOnly = true)
  public List<Task> reviewQueue(Long listId, User user) {
    return visibleIn(listId, user).stream().filter(t -> t.isReviewDue(clock.instant())).toList();
  }

  @Transactional(readOnly = true)
  public List<Task> reviewQueue(User user, BoardFilter filter) {
    return board(user, filter).stream().filter(t -> t.isReviewDue(clock.instant())).toList();
  }
}
