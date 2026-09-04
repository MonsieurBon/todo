package ch.ethy.todo.web.dto;

import ch.ethy.todo.domain.TaskZone;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/** Request bodies. Validation lives here so invalid input never reaches the domain. */
public final class Requests {

  private Requests() {}

  public record CreateTaskList(@NotBlank @Size(max = 255) String name) {}

  public record RenameTaskList(@NotBlank @Size(max = 255) String name) {}

  public record Share(@NotBlank @Email String email) {}

  /**
   * {@code clientRef} is the caller's own reference for the task, and it is what makes a create
   * safe to repeat: the web app queues captures made offline and replays them on reconnect, where a
   * lost response looks exactly like a lost request. Sending the same reference twice yields the
   * same task rather than two. Optional — every caller without a queue omits it.
   */
  public record CreateTask(
      @NotBlank @Size(max = 255) String title,
      @Size(max = 10_000) String notes,
      @NotNull TaskZone zone,
      LocalDate dueDate,
      List<String> labels,
      @Size(max = 64) String clientRef) {}

  /**
   * The capture path. Zone is optional because a capture-only client has no read scope and so no
   * way to see how full the zones already are; defaulting keeps the call to a single argument.
   */
  public record CaptureTask(
      @NotBlank @Size(max = 255) String title,
      @Size(max = 10_000) String notes,
      TaskZone zone,
      LocalDate dueDate,
      List<String> labels,
      @Size(max = 64) String clientRef) {
    public TaskZone zoneOrDefault() {
      return zone == null ? TaskZone.OPPORTUNITY_NOW : zone;
    }
  }

  public record UpdateTask(
      @Size(max = 255) String title, @Size(max = 10_000) String notes, LocalDate dueDate) {}

  public record MoveZone(@NotNull TaskZone zone) {}

  public record Defer(@NotNull @FutureOrPresent LocalDate until) {}

  /** Replaces every topic on a task. Labels are normalised, so any spelling works. */
  public record SetLabels(@NotNull List<@Size(max = 64) String> labels) {}
}
