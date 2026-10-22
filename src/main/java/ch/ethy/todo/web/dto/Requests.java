package ch.ethy.todo.web.dto;

import ch.ethy.todo.domain.RecurrenceUnit;
import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.TaskZone;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public final class Requests {

  private Requests() {}

  public record CreateTaskList(@NotBlank @Size(max = TaskList.MAX_NAME_LENGTH) String name) {}

  public record RenameTaskList(@NotBlank @Size(max = TaskList.MAX_NAME_LENGTH) String name) {}

  public record Share(@NotBlank @Email String email) {}

  /** Sent and read back alike, so the contract has one shape for it. */
  public record Recurrence(
      @NotNull @Min(1) @Max(ch.ethy.todo.domain.Recurrence.MAX_EVERY) Integer every,
      @NotNull RecurrenceUnit unit) {

    public static Recurrence of(ch.ethy.todo.domain.Recurrence recurrence) {
      return recurrence == null ? null : new Recurrence(recurrence.every(), recurrence.unit());
    }

    public static ch.ethy.todo.domain.Recurrence toDomain(Recurrence recurrence) {
      return recurrence == null
          ? null
          : new ch.ethy.todo.domain.Recurrence(recurrence.every(), recurrence.unit());
    }
  }

  public record CreateTask(
      @NotBlank @Size(max = Task.MAX_TITLE_LENGTH) String title,
      @Size(max = Task.MAX_NOTES_LENGTH) String notes,
      @NotNull TaskZone zone,
      LocalDate dueDate,
      @Valid Recurrence recurrence,
      List<@Size(max = Task.MAX_LABEL_LENGTH) String> labels,
      @Size(max = Task.MAX_CLIENT_REF_LENGTH) String clientRef) {}

  /**
   * Zone is optional here, unlike {@link CreateTask}: a capture-only client cannot see the board.
   */
  public record CaptureTask(
      @NotBlank @Size(max = Task.MAX_TITLE_LENGTH) String title,
      @Size(max = Task.MAX_NOTES_LENGTH) String notes,
      TaskZone zone,
      LocalDate dueDate,
      @Valid Recurrence recurrence,
      List<@Size(max = Task.MAX_LABEL_LENGTH) String> labels,
      @Size(max = Task.MAX_CLIENT_REF_LENGTH) String clientRef) {
    public TaskZone zoneOrDefault() {
      return zone == null ? TaskZone.OPPORTUNITY_NOW : zone;
    }
  }

  public record UpdateTask(
      @Size(max = Task.MAX_TITLE_LENGTH) String title,
      @Size(max = Task.MAX_NOTES_LENGTH) String notes,
      LocalDate dueDate,
      Boolean clearDueDate,
      @Valid Recurrence recurrence,
      Boolean clearRecurrence) {}

  public record MoveZone(@NotNull TaskZone zone) {}

  public record Defer(@NotNull @FutureOrPresent LocalDate until) {}

  public record SetLabels(@NotNull List<@Size(max = Task.MAX_LABEL_LENGTH) String> labels) {}

  public record Selection(@NotEmpty List<@NotNull Long> taskIds) {}

  public record MoveSelection(@NotEmpty List<@NotNull Long> taskIds, @NotNull TaskZone zone) {}

  public record DeferSelection(
      @NotEmpty List<@NotNull Long> taskIds, @NotNull @FutureOrPresent LocalDate until) {}
}
