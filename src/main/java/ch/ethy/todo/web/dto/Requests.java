package ch.ethy.todo.web.dto;

import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.TaskZone;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * Request bodies. Validation lives here so a bad body is answered as a field-by-field 400 rather
 * than as a domain exception — but the limits themselves belong to the entities, because the MCP
 * tools never pass through here. Constraining against their constants is what keeps the two answers
 * to "how long may a title be" the same answer.
 */
public final class Requests {

  private Requests() {}

  public record CreateTaskList(@NotBlank @Size(max = TaskList.MAX_NAME_LENGTH) String name) {}

  public record RenameTaskList(@NotBlank @Size(max = TaskList.MAX_NAME_LENGTH) String name) {}

  public record Share(@NotBlank @Email String email) {}

  /**
   * {@code clientRef} is the caller's own reference for the task, and it is what makes a create
   * safe to repeat: the web app queues captures made offline and replays them on reconnect, where a
   * lost response looks exactly like a lost request. Sending the same reference twice yields the
   * same task rather than two. Optional — every caller without a queue omits it.
   */
  public record CreateTask(
      @NotBlank @Size(max = Task.MAX_TITLE_LENGTH) String title,
      @Size(max = Task.MAX_NOTES_LENGTH) String notes,
      @NotNull TaskZone zone,
      LocalDate dueDate,
      List<@Size(max = Task.MAX_LABEL_LENGTH) String> labels,
      @Size(max = Task.MAX_CLIENT_REF_LENGTH) String clientRef) {}

  /**
   * The capture path. Zone is optional because a capture-only client has no read scope and so no
   * way to see how full the zones already are; defaulting keeps the call to a single argument.
   */
  public record CaptureTask(
      @NotBlank @Size(max = Task.MAX_TITLE_LENGTH) String title,
      @Size(max = Task.MAX_NOTES_LENGTH) String notes,
      TaskZone zone,
      LocalDate dueDate,
      List<@Size(max = Task.MAX_LABEL_LENGTH) String> labels,
      @Size(max = Task.MAX_CLIENT_REF_LENGTH) String clientRef) {
    public TaskZone zoneOrDefault() {
      return zone == null ? TaskZone.OPPORTUNITY_NOW : zone;
    }
  }

  public record UpdateTask(
      @Size(max = Task.MAX_TITLE_LENGTH) String title,
      @Size(max = Task.MAX_NOTES_LENGTH) String notes,
      LocalDate dueDate) {}

  public record MoveZone(@NotNull TaskZone zone) {}

  public record Defer(@NotNull @FutureOrPresent LocalDate until) {}

  /** Replaces every topic on a task. Labels are normalised, so any spelling works. */
  public record SetLabels(@NotNull List<@Size(max = Task.MAX_LABEL_LENGTH) String> labels) {}
}
