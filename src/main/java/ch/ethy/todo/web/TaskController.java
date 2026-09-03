package ch.ethy.todo.web;

import ch.ethy.todo.service.CurrentUserService;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
   * Files a task without naming a list. This is what a capture-only client calls: it has no read
   * scope, so it cannot discover a list id to post to.
   */
  @PostMapping("/tasks/capture")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyAuthority('SCOPE_todo:capture', 'SCOPE_todo:write')")
  public Responses.TaskView capture(@Valid @RequestBody Requests.CaptureTask request) {
    return Responses.TaskView.of(
        tasks.capture(currentUser.current(), request.title(), request.zoneOrDefault()));
  }

  @PostMapping("/tasklists/{listId}/tasks")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAnyAuthority('SCOPE_todo:capture', 'SCOPE_todo:write')")
  public Responses.TaskView add(
      @PathVariable Long listId, @Valid @RequestBody Requests.CreateTask request) {
    return Responses.TaskView.of(
        tasks.addTo(listId, currentUser.current(), request.title(), request.zone()));
  }

  @GetMapping("/tasklists/{listId}/tasks")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public List<Responses.TaskView> inList(@PathVariable Long listId) {
    return tasks.visibleIn(listId, currentUser.current()).stream()
        .map(Responses.TaskView::of)
        .toList();
  }

  /** The review sweep: what this list is overdue to look at, per its zones' cadences. */
  @GetMapping("/tasklists/{listId}/review")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public List<Responses.TaskView> review(@PathVariable Long listId) {
    return tasks.reviewQueue(listId, currentUser.current()).stream()
        .map(Responses.TaskView::of)
        .toList();
  }

  @GetMapping("/tasks/{id}")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public Responses.TaskView one(@PathVariable Long id) {
    return Responses.TaskView.of(tasks.accessible(id, currentUser.current()));
  }

  @PatchMapping("/tasks/{id}")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView update(
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
  public Responses.TaskView complete(@PathVariable Long id) {
    return Responses.TaskView.of(tasks.complete(id, currentUser.current()));
  }

  @PostMapping("/tasks/{id}/reopen")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView reopen(@PathVariable Long id) {
    return Responses.TaskView.of(tasks.reopen(id, currentUser.current()));
  }

  @PostMapping("/tasks/{id}/zone")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView move(
      @PathVariable Long id, @Valid @RequestBody Requests.MoveZone request) {
    return Responses.TaskView.of(tasks.moveTo(id, currentUser.current(), request.zone()));
  }

  @PostMapping("/tasks/{id}/defer")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView defer(
      @PathVariable Long id, @Valid @RequestBody Requests.Defer request) {
    return Responses.TaskView.of(tasks.defer(id, currentUser.current(), request.until()));
  }

  @PostMapping("/tasks/{id}/reviewed")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Responses.TaskView reviewed(@PathVariable Long id) {
    return Responses.TaskView.of(tasks.markReviewed(id, currentUser.current()));
  }

  @DeleteMapping("/tasks/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public void delete(@PathVariable Long id) {
    tasks.delete(id, currentUser.current());
  }
}
