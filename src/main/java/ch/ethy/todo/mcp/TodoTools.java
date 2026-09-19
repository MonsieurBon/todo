package ch.ethy.todo.mcp;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.service.BoardFilter;
import ch.ethy.todo.service.CurrentUserService;
import ch.ethy.todo.service.NewTask;
import ch.ethy.todo.service.TaskEdit;
import ch.ethy.todo.service.TaskListService;
import ch.ethy.todo.service.TaskService;
import ch.ethy.todo.web.dto.Responses;
import java.time.LocalDate;
import java.util.List;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

/**
 * Descriptions here are written for a model, not a developer: they carry the method's discipline,
 * because an assistant that does not know the rules will file forty tasks as Critical Now.
 */
@Component
public class TodoTools {

  private final TaskService tasks;
  private final TaskListService lists;
  private final CurrentUserService currentUser;

  public TodoTools(TaskService tasks, TaskListService lists, CurrentUserService currentUser) {
    this.tasks = tasks;
    this.lists = lists;
    this.currentUser = currentUser;
  }

  @McpTool(
      name = "create_task",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = false,
              idempotentHint = false,
              openWorldHint = false),
      title = "Add a task",
      description =
          """
          Add a task to the user's One Minute To-Do List.

          Choose the zone by urgency, not by importance:
            CRITICAL_NOW     - must genuinely be done today. Meant to hold about five
                               items in total; do not use it as a default.
            OPPORTUNITY_NOW  - should be done soon, whenever the chance arises. The
                               right choice for most tasks. Holds about twenty.
            OVER_THE_HORIZON - not now. Unlimited, and reviewed weekly.

          If no zone is given, OPPORTUNITY_NOW is used. If no list is named the task
          goes to the user's inbox. Labels are topics such as "house" or "project-a";
          a task may carry several, and they are how tasks are grouped across lists.

          Keep the title short enough to scan; anything longer goes in the notes.
          """)
  public Responses.TaskView createTask(
      @McpToolParam(
              description = "What needs doing. At most " + Task.MAX_TITLE_LENGTH + " characters.",
              required = true)
          String title,
      @McpToolParam(
              description = "CRITICAL_NOW, OPPORTUNITY_NOW or OVER_THE_HORIZON.",
              required = false)
          TaskZone zone,
      @McpToolParam(
              description =
                  "Topics for this task, e.g. [\"house\", \"project-a\"]. At most "
                      + Task.MAX_LABEL_LENGTH
                      + " characters each.",
              required = false)
          List<String> labels,
      @McpToolParam(
              description = "Id of the list to file into. Omit to use the inbox.",
              required = false)
          Long listId,
      @McpToolParam(
              description =
                  "Detail that does not belong in the title. At most "
                      + Task.MAX_NOTES_LENGTH
                      + " characters.",
              required = false)
          String notes,
      @McpToolParam(
              description =
                  "When it must be finished, as YYYY-MM-DD. Not a deferral: it does not hide"
                      + " the task.",
              required = false)
          LocalDate dueDate) {
    var me = currentUser.current();
    TaskZone target = zone == null ? TaskZone.OPPORTUNITY_NOW : zone;
    var draft = new NewTask(title, target, notes, dueDate, labels, null);
    return Responses.TaskView.of(
        listId == null ? tasks.capture(me, draft) : tasks.addTo(listId, me, draft));
  }

  @McpTool(
      name = "update_task",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = true,
              idempotentHint = true,
              openWorldHint = false),
      title = "Edit a task",
      description =
          """
          Change a task's title, notes or due date. Only what is passed changes;
          anything omitted keeps its current value. Notes are replaced whole, so to add
          to them pass the existing notes with the addition.

          Zone, deferral, topics and completion have their own tools.
          """)
  public Responses.TaskView updateTask(
      @McpToolParam(description = "Id of the task.", required = true) Long taskId,
      @McpToolParam(
              description = "New title. At most " + Task.MAX_TITLE_LENGTH + " characters.",
              required = false)
          String title,
      @McpToolParam(
              description =
                  "New notes, replacing the old ones. At most "
                      + Task.MAX_NOTES_LENGTH
                      + " characters; an empty string clears them.",
              required = false)
          String notes,
      @McpToolParam(description = "New due date, as YYYY-MM-DD.", required = false)
          LocalDate dueDate,
      @McpToolParam(
              description = "True to remove the due date. Cannot be combined with dueDate.",
              required = false)
          Boolean clearDueDate) {
    return Responses.TaskView.of(
        tasks.update(
            taskId,
            currentUser.current(),
            new TaskEdit(title, notes, dueDate, Boolean.TRUE.equals(clearDueDate))));
  }

  @McpTool(
      name = "get_board",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = true,
              destructiveHint = false,
              idempotentHint = true,
              openWorldHint = false),
      title = "Read the to-do list",
      description =
          """
          Read the user's tasks, grouped into the three urgency zones.

          Returns every task the user can see across all their lists unless narrowed.
          Each zone reports how many open tasks it holds and whether that is over what
          the method says it should hold; if CRITICAL_NOW is over its cap, say so and
          offer to move something out rather than adding more.

          Deferred tasks and completed tasks are hidden by default.
          """)
  public Responses.BoardView getBoard(
      @McpToolParam(description = "Only this topic, e.g. \"house\".", required = false)
          String label,
      @McpToolParam(description = "Only this list id.", required = false) Long listId,
      @McpToolParam(description = "Only this zone.", required = false) TaskZone zone,
      @McpToolParam(description = "Include completed tasks.", required = false)
          Boolean includeDone) {
    var me = currentUser.current();
    var filter = new BoardFilter(listId, label, zone, Boolean.TRUE.equals(includeDone));
    return new Responses.BoardView(
        Responses.ZoneLoad.of(tasks.zoneLoads(me, filter)),
        tasks.board(me, filter).stream().map(Responses.TaskView::of).toList());
  }

  @McpTool(
      name = "list_labels",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = true,
              destructiveHint = false,
              idempotentHint = true,
              openWorldHint = false),
      title = "List topics",
      description =
          "Every topic in use across the user's tasks. Prefer reusing one of these over "
              + "inventing a new one, so related tasks stay grouped.")
  public List<String> listLabels() {
    return tasks.labelsVisibleTo(currentUser.current());
  }

  @McpTool(
      name = "list_tasklists",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = true,
              destructiveHint = false,
              idempotentHint = true,
              openWorldHint = false),
      title = "List the user's lists",
      description =
          """
          The user's lists. A list is a sharing boundary, not a topic — typically one
          personal list and one shared with family. Use labels for topics instead of
          asking the user to create more lists.
          """)
  public List<Responses.TaskListSummary> listTaskLists() {
    var me = currentUser.current();
    return lists.visibleTo(me).stream().map(l -> Responses.TaskListSummary.of(l, me)).toList();
  }

  @McpTool(
      name = "get_review_queue",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = true,
              destructiveHint = false,
              idempotentHint = true,
              openWorldHint = false),
      title = "What is due for review",
      description =
          """
          The tasks overdue for a review sweep: Opportunity Now is swept daily and Over
          The Horizon weekly. Critical Now never appears here because it is worked
          continuously rather than reviewed.

          Walk these one at a time with the user and for each one promote, demote,
          complete, defer or delete it, then call mark_task_reviewed.
          """)
  public List<Responses.TaskView> getReviewQueue(
      @McpToolParam(description = "The list to sweep.", required = true) Long listId) {
    return tasks.reviewQueue(listId, currentUser.current()).stream()
        .map(Responses.TaskView::of)
        .toList();
  }

  @McpTool(
      name = "complete_task",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = true,
              idempotentHint = true,
              openWorldHint = false),
      title = "Mark a task done",
      description = "Mark a task as completed. It drops off the list immediately.")
  public Responses.TaskView completeTask(
      @McpToolParam(description = "Id of the task.", required = true) Long taskId) {
    return Responses.TaskView.of(tasks.complete(taskId, currentUser.current()));
  }

  @McpTool(
      name = "reopen_task",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = true,
              idempotentHint = true,
              openWorldHint = false),
      title = "Reopen a task",
      description =
          """
          Undo complete_task: the task is open again, in the zone it was in.
          get_board with includeDone finds completed tasks.

          Afterwards, check get_board: if the task's zone is now over its cap, say so
          and offer to move something out.
          """)
  public Responses.TaskView reopenTask(
      @McpToolParam(description = "Id of the task.", required = true) Long taskId) {
    return Responses.TaskView.of(tasks.reopen(taskId, currentUser.current()));
  }

  @McpTool(
      name = "move_task_zone",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = true,
              idempotentHint = true,
              openWorldHint = false),
      title = "Change a task's urgency",
      description =
          """
          Move a task to a different urgency zone. Moving a task clears any deferral,
          since deciding where it belongs is the attention that deferring postponed.

          Before promoting into CRITICAL_NOW, check get_board: if that zone is already
          at its cap, something should come out before anything else goes in.
          """)
  public Responses.TaskView moveTaskZone(
      @McpToolParam(description = "Id of the task.", required = true) Long taskId,
      @McpToolParam(description = "The zone to move it to.", required = true) TaskZone zone) {
    return Responses.TaskView.of(tasks.moveTo(taskId, currentUser.current(), zone));
  }

  @McpTool(
      name = "defer_task",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = true,
              idempotentHint = true,
              openWorldHint = false),
      title = "Hide a task until a date",
      description =
          """
          Push a task over the horizon and hide it until the given date, when it comes
          back by itself. This is for "not yet", and is different from a due date:
          deferring says when the user wants to see it again, a due date says when it
          must be finished. The date cannot be in the past.
          """)
  public Responses.TaskView deferTask(
      @McpToolParam(description = "Id of the task.", required = true) Long taskId,
      @McpToolParam(description = "Date to bring it back, as YYYY-MM-DD.", required = true)
          LocalDate until) {
    return Responses.TaskView.of(tasks.defer(taskId, currentUser.current(), until));
  }

  @McpTool(
      name = "set_task_labels",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = true,
              idempotentHint = true,
              openWorldHint = false),
      title = "Set a task's topics",
      description =
          "Replace every topic on a task. Pass the complete set, not just the additions. "
              + "Call list_labels first so existing topics are reused rather than duplicated.")
  public Responses.TaskView setTaskLabels(
      @McpToolParam(description = "Id of the task.", required = true) Long taskId,
      @McpToolParam(
              description =
                  "The complete set of topics, at most "
                      + Task.MAX_LABEL_LENGTH
                      + " characters each.",
              required = true)
          List<String> labels) {
    return Responses.TaskView.of(tasks.setLabels(taskId, currentUser.current(), labels));
  }

  @McpTool(
      name = "mark_task_reviewed",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = true,
              idempotentHint = true,
              openWorldHint = false),
      title = "Record a review",
      description =
          "Record that a task was considered during a review sweep, so it drops out of "
              + "the review queue until its zone's cadence comes round again.")
  public Responses.TaskView markTaskReviewed(
      @McpToolParam(description = "Id of the task.", required = true) Long taskId) {
    return Responses.TaskView.of(tasks.markReviewed(taskId, currentUser.current()));
  }

  @McpTool(
      name = "delete_task",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = true,
              idempotentHint = true,
              openWorldHint = false),
      title = "Delete a task",
      description =
          "Delete a task permanently. Prefer complete_task for something that was done; "
              + "this is for something that should never have been on the list.")
  public String deleteTask(
      @McpToolParam(description = "Id of the task.", required = true) Long taskId) {
    tasks.delete(taskId, currentUser.current());
    return "Deleted task " + taskId;
  }

  @McpTool(
      name = "create_tasklist",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = false,
              idempotentHint = false,
              openWorldHint = false),
      title = "Create a list",
      description =
          """
          Create a new list. Lists are sharing boundaries, so create one only when the
          user needs to share with a different person — most users need just a personal
          list and a shared one. For separating topics, use labels instead.
          """)
  public Responses.TaskListSummary createTaskList(
      @McpToolParam(
              description =
                  "Name of the list. At most " + TaskList.MAX_NAME_LENGTH + " characters.",
              required = true)
          String name) {
    var me = currentUser.current();
    return Responses.TaskListSummary.of(lists.create(me, name), me);
  }

  @McpTool(
      name = "share_tasklist",
      annotations =
          @McpTool.McpAnnotations(
              readOnlyHint = false,
              destructiveHint = false,
              idempotentHint = true,
              openWorldHint = false),
      title = "Share a list",
      description =
          "Share a list with another registered user by email. They will be able to read "
              + "and change its tasks, but not rename, delete or re-share the list.")
  public Responses.TaskListSummary shareTaskList(
      @McpToolParam(description = "Id of the list.", required = true) Long listId,
      @McpToolParam(description = "Email of the person to share with.", required = true)
          String email) {
    var me = currentUser.current();
    return Responses.TaskListSummary.of(lists.share(listId, me, email), me);
  }
}
