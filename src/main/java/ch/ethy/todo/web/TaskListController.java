package ch.ethy.todo.web;

import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.service.BoardFilter;
import ch.ethy.todo.service.CurrentUserService;
import ch.ethy.todo.service.TaskListService;
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
@RequestMapping("/api/tasklists")
public class TaskListController {

  private final TaskListService lists;
  private final TaskService tasks;
  private final CurrentUserService currentUser;

  public TaskListController(
      TaskListService lists, TaskService tasks, CurrentUserService currentUser) {
    this.lists = lists;
    this.tasks = tasks;
    this.currentUser = currentUser;
  }

  @GetMapping
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public List<Responses.TaskListSummary> allLists() {
    User me = currentUser.current();
    return lists.visibleTo(me).stream().map(l -> Responses.TaskListSummary.of(l, me)).toList();
  }

  @GetMapping("/{id}")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public Responses.TaskListDetail oneList(@PathVariable Long id) {
    User me = currentUser.current();
    TaskList list = lists.accessible(id, me);
    return new Responses.TaskListDetail(
        Responses.TaskListSummary.of(list, me),
        // Counted through the same board query, scoped to this list. These numbers are
        // informational: the caps that matter are the ones on the board, across every list.
        Responses.ZoneLoad.of(tasks.zoneLoads(me, BoardFilter.forList(id))),
        tasks.visibleIn(id, me).stream().map(Responses.TaskView::of).toList());
  }

  @GetMapping("/by-slug/{slug}")
  @PreAuthorize("hasAuthority('SCOPE_todo:read')")
  public Responses.TaskListSummary listBySlug(@PathVariable String slug) {
    User me = currentUser.current();
    return Responses.TaskListSummary.of(lists.bySlug(slug, me), me);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAuthority('SCOPE_todo:admin')")
  public Responses.TaskListSummary createList(@Valid @RequestBody Requests.CreateTaskList request) {
    User me = currentUser.current();
    return Responses.TaskListSummary.of(lists.create(me, request.name()), me);
  }

  @PatchMapping("/{id}")
  @PreAuthorize("hasAuthority('SCOPE_todo:admin')")
  public Responses.TaskListSummary renameList(
      @PathVariable Long id, @Valid @RequestBody Requests.RenameTaskList request) {
    User me = currentUser.current();
    return Responses.TaskListSummary.of(lists.rename(id, me, request.name()), me);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("hasAuthority('SCOPE_todo:admin')")
  public void deleteList(@PathVariable Long id) {
    lists.delete(id, currentUser.current());
  }

  @PostMapping("/{id}/shares")
  @PreAuthorize("hasAuthority('SCOPE_todo:admin')")
  public Responses.TaskListSummary shareList(
      @PathVariable Long id, @Valid @RequestBody Requests.Share request) {
    User me = currentUser.current();
    return Responses.TaskListSummary.of(lists.share(id, me, request.email()), me);
  }

  @DeleteMapping("/{id}/shares")
  @PreAuthorize("hasAuthority('SCOPE_todo:admin')")
  public Responses.TaskListSummary unshareList(
      @PathVariable Long id, @Valid @RequestBody Requests.Share request) {
    User me = currentUser.current();
    return Responses.TaskListSummary.of(lists.unshare(id, me, request.email()), me);
  }
}
