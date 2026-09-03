package ch.ethy.todo.web;

import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.service.BoardFilter;
import ch.ethy.todo.service.CurrentUserService;
import ch.ethy.todo.service.NewTask;
import ch.ethy.todo.service.TaskService;
import ch.ethy.todo.web.dto.Requests;
import ch.ethy.todo.web.dto.Responses;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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

  public TaskController(TaskService tasks, CurrentUserService currentUser) {
    this.tasks = tasks;
    this.currentUser = currentUser;
  }

  /**
   * The board: every task the user can see, in three zones, with the caps counted across the whole
   * filtered set. This is the app's default view — lists and labels are filters on top of it, not
   * things you navigate between.
   */
  @GetMapping("/board")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public Responses.BoardView board(
      @RequestParam(required = false) Long list,
      @RequestParam(required = false) String label,
      @RequestParam(required = false) TaskZone zone,
      @RequestParam(defaultValue = "false") boolean includeDone) {
    var me = currentUser.current();
    var filter = new BoardFilter(list, label, zone, includeDone);
    return new Responses.BoardView(
        Responses.ZoneLoad.of(tasks.zoneLoads(me, filter)),
        tasks.board(me, filter).stream().map(Responses.TaskView::of).toList());
  }

  /**
   * The review sweep across everything visible: what is overdue to be looked at, per each zone's
   * cadence. Scoped by the same filters as the board, because the caps the sweep is protecting are
   * counted the same way.
   */
  @GetMapping("/review")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public List<Responses.TaskView> review(
      @RequestParam(required = false) Long list, @RequestParam(required = false) String label) {
    var me = currentUser.current();
    return tasks.reviewQueue(me, new BoardFilter(list, label, null, false)).stream()
        .map(Responses.TaskView::of)
        .toList();
  }

  /** Every topic in use, for autocomplete and the filter menu. */
  @GetMapping("/labels")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public List<String> allLabels() {
    return tasks.labelsVisibleTo(currentUser.current());
  }

  /**
   * Files a task without naming a list. This is what a capture-only client calls: it has no read
   * scope, so it cannot discover a list id to post to.
   */
  @PostMapping("/tasks/capture")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyAuthority('SCOPE_todo:capture', 'SCOPE_todo:write')")
  public Responses.TaskView captureTask(@Valid @RequestBody Requests.CaptureTask request) {
    return Responses.TaskView.of(
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
  @PreAuthorize("hasAnyAuthority('SCOPE_todo:capture', 'SCOPE_todo:write')")
  public Responses.TaskView addTaskToList(
      @PathVariable Long listId, @Valid @RequestBody Requests.CreateTask request) {
    return Responses.TaskView.of(
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
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public List<Responses.TaskView> tasksInList(@PathVariable Long listId) {
    return tasks.visibleIn(listId, currentUser.current()).stream()
        .map(Responses.TaskView::of)
        .toList();
  }

  /** The review sweep: what this list is overdue to look at, per its zones' cadences. */
  @GetMapping("/tasklists/{listId}/review")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public List<Responses.TaskView> reviewInList(@PathVariable Long listId) {
    return tasks.reviewQueue(listId, currentUser.current()).stream()
        .map(Responses.TaskView::of)
        .toList();
  }

  @GetMapping("/tasks/{id}")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public Responses.TaskView oneTask(@PathVariable Long id) {
    return Responses.TaskView.of(tasks.accessible(id, currentUser.current()));
  }

  @PatchMapping("/tasks/{id}")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView updateTask(
      @PathVariable Long id, @Valid @RequestBody Requests.UpdateTask request) {
    var task = tasks.accessible(id, currentUser.current());
    if (request.title() != null) {
      task.title(request.title());
    }
    if (request.notes() != null) {
      task.notes(request.notes());
    }
    if (request.dueDate() != null) {
      task.dueDate(request.dueDate());
    }
    return Responses.TaskView.of(task);
  }

  @PostMapping("/tasks/{id}/complete")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView completeTask(@PathVariable Long id) {
    return Responses.TaskView.of(tasks.complete(id, currentUser.current()));
  }

  @PostMapping("/tasks/{id}/reopen")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView reopenTask(@PathVariable Long id) {
    return Responses.TaskView.of(tasks.reopen(id, currentUser.current()));
  }

  @PostMapping("/tasks/{id}/zone")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView moveTaskZone(
      @PathVariable Long id, @Valid @RequestBody Requests.MoveZone request) {
    return Responses.TaskView.of(tasks.moveTo(id, currentUser.current(), request.zone()));
  }

  @PostMapping("/tasks/{id}/defer")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView deferTask(
      @PathVariable Long id, @Valid @RequestBody Requests.Defer request) {
    return Responses.TaskView.of(tasks.defer(id, currentUser.current(), request.until()));
  }

  @PostMapping("/tasks/{id}/reviewed")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView markTaskReviewed(@PathVariable Long id) {
    return Responses.TaskView.of(tasks.markReviewed(id, currentUser.current()));
  }

  @PutMapping("/tasks/{id}/labels")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView setTaskLabels(
      @PathVariable Long id, @Valid @RequestBody Requests.SetLabels request) {
    return Responses.TaskView.of(tasks.setLabels(id, currentUser.current(), request.labels()));
  }

  @DeleteMapping("/tasks/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public void deleteTask(@PathVariable Long id) {
    tasks.delete(id, currentUser.current());
  }
}
