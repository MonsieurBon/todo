package ch.ethy.todo.web.dto;

import ch.ethy.todo.domain.TaskZone;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Request bodies. Validation lives here so invalid input never reaches the domain. */
public final class Requests {

  private Requests() {}

  public record CreateTaskList(@NotBlank @Size(max = 255) String name) {}

  public record RenameTaskList(@NotBlank @Size(max = 255) String name) {}

  public record Share(@NotBlank @Email String email) {}

  public record CreateTask(
      @NotBlank @Size(max = 255) String title,
      @Size(max = 10_000) String notes,
      @NotNull TaskZone zone,
      LocalDate dueDate) {}

  /**
   * The capture path. Zone is optional because a capture-only client has no read scope and so no
   * way to see how full the zones already are; defaulting keeps the call to a single argument.
   */
  public record CaptureTask(@NotBlank @Size(max = 255) String title, TaskZone zone) {
    public TaskZone zoneOrDefault() {
      return zone == null ? TaskZone.OPPORTUNITY_NOW : zone;
    }
  }

  public record UpdateTask(
      @Size(max = 255) String title, @Size(max = 10_000) String notes, LocalDate dueDate) {}

  public record MoveZone(@NotNull TaskZone zone) {}

  public record Defer(@NotNull @FutureOrPresent LocalDate until) {}
}
