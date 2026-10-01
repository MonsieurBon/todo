package ch.ethy.todo.web;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.service.Board;
import ch.ethy.todo.service.BoardFilter;
import ch.ethy.todo.service.CurrentUserService;
import ch.ethy.todo.service.NewTask;
import ch.ethy.todo.service.TaskEdit;
import ch.ethy.todo.service.TaskService;
import ch.ethy.todo.web.dto.Requests;
import ch.ethy.todo.web.dto.Responses;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TaskController {

  private final TaskService tasks;
  private final CurrentUserService currentUser;
  private final Clock clock;

  public TaskController(TaskService tasks, CurrentUserService currentUser, Clock clock) {
    this.tasks = tasks;
    this.currentUser = currentUser;
    this.clock = clock;
  }

  @GetMapping("/board")
  public Responses.BoardView board(
      @RequestParam(required = false) Long list,
      @RequestParam(required = false) String label,
      @RequestParam(required = false) TaskZone zone,
      @RequestParam(defaultValue = "false") boolean includeDone,
      @RequestParam(defaultValue = "false") boolean includeDeferred) {
    var me = currentUser.current();
    var filter = new BoardFilter(list, label, zone, includeDone, includeDeferred);
    Board board = tasks.board(me, filter);
    return new Responses.BoardView(Responses.ZoneLoad.of(board.loads()), views(board));
  }

  @GetMapping("/review")
  public List<Responses.TaskView> review(
      @RequestParam(required = false) Long list, @RequestParam(required = false) String label) {
    var me = currentUser.current();
    return tasks.reviewQueue(me, new BoardFilter(list, label, null, false, false)).stream()
        .map(this::view)
        .toList();
  }

  @GetMapping("/labels")
  public List<String> allLabels() {
    return tasks.labelsVisibleTo(currentUser.current());
  }

  @PostMapping("/tasks/capture")
  @ResponseStatus(HttpStatus.CREATED)
  public Responses.TaskView captureTask(@Valid @RequestBody Requests.CaptureTask request) {
    return view(
        tasks.capture(
            currentUser.current(),
            new NewTask(
                request.title(),
                request.zoneOrDefault(),
                request.notes(),
                request.dueDate(),
                request.labels(),
                request.clientRef())));
  }

  @PostMapping("/tasklists/{listId}/tasks")
  @ResponseStatus(HttpStatus.CREATED)
  public Responses.TaskView addTaskToList(
      @PathVariable Long listId, @Valid @RequestBody Requests.CreateTask request) {
    return view(
        tasks.addTo(
            listId,
            currentUser.current(),
            new NewTask(
                request.title(),
                request.zone(),
                request.notes(),
                request.dueDate(),
                request.labels(),
                request.clientRef())));
  }

  @GetMapping("/tasklists/{listId}/tasks")
  public List<Responses.TaskView> tasksInList(@PathVariable Long listId) {
    return views(tasks.visibleIn(listId, currentUser.current()));
  }

  /** The review sweep: what this list is overdue to look at, per its zones' cadences. */
  @GetMapping("/tasklists/{listId}/review")
  public List<Responses.TaskView> reviewInList(@PathVariable Long listId) {
    return tasks.reviewQueue(listId, currentUser.current()).stream().map(this::view).toList();
  }

  @GetMapping("/tasks/{id}")
  public Responses.TaskView oneTask(@PathVariable Long id) {
    return view(tasks.accessible(id, currentUser.current()));
  }

  @PatchMapping("/tasks/{id}")
  public Responses.TaskView updateTask(
      @PathVariable Long id, @Valid @RequestBody Requests.UpdateTask request) {
    return view(
        tasks.update(
            id,
            currentUser.current(),
            new TaskEdit(
                request.title(),
                request.notes(),
                request.dueDate(),
                Boolean.TRUE.equals(request.clearDueDate()))));
  }

  @PostMapping("/tasks/{id}/complete")
  public Responses.TaskView completeTask(@PathVariable Long id) {
    return view(tasks.complete(id, currentUser.current()));
  }

  @PostMapping("/tasks/{id}/reopen")
  public Responses.TaskView reopenTask(@PathVariable Long id) {
    return view(tasks.reopen(id, currentUser.current()));
  }

  @PostMapping("/tasks/{id}/zone")
  public Responses.TaskView moveTaskZone(
      @PathVariable Long id, @Valid @RequestBody Requests.MoveZone request) {
    return view(tasks.moveTo(id, currentUser.current(), request.zone()));
  }

  @PostMapping("/tasks/{id}/defer")
  public Responses.TaskView deferTask(
      @PathVariable Long id, @Valid @RequestBody Requests.Defer request) {
    return view(tasks.defer(id, currentUser.current(), request.until()));
  }

  @PostMapping("/tasks/{id}/reviewed")
  public Responses.TaskView markTaskReviewed(@PathVariable Long id) {
    return view(tasks.markReviewed(id, currentUser.current()));
  }

  @PostMapping("/tasks/reviewed")
  public List<Responses.TaskView> markTasksReviewed(
      @Valid @RequestBody Requests.Selection request) {
    return tasks.markAllReviewed(request.taskIds(), currentUser.current()).stream()
        .map(this::view)
        .toList();
  }

  @PostMapping("/tasks/zone")
  public List<Responses.TaskView> moveTasksToZone(
      @Valid @RequestBody Requests.MoveSelection request) {
    return tasks.moveAllTo(request.taskIds(), currentUser.current(), request.zone()).stream()
        .map(this::view)
        .toList();
  }

  @PostMapping("/tasks/defer")
  public List<Responses.TaskView> deferTasks(@Valid @RequestBody Requests.DeferSelection request) {
    return tasks.deferAll(request.taskIds(), currentUser.current(), request.until()).stream()
        .map(this::view)
        .toList();
  }

  @PutMapping("/tasks/{id}/labels")
  public Responses.TaskView setTaskLabels(
      @PathVariable Long id, @Valid @RequestBody Requests.SetLabels request) {
    return view(tasks.setLabels(id, currentUser.current(), request.labels()));
  }

  @DeleteMapping("/tasks/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteTask(@PathVariable Long id) {
    tasks.delete(id, currentUser.current());
  }

  private Responses.TaskView view(Task task) {
    return Responses.TaskView.of(task, LocalDate.now(clock));
  }

  private static List<Responses.TaskView> views(Board board) {
    return board.tasks().stream().map(task -> Responses.TaskView.of(task, board.today())).toList();
  }
}
