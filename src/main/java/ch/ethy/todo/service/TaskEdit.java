package ch.ethy.todo.service;

import ch.ethy.todo.domain.Recurrence;
import java.time.LocalDate;

/**
 * Null means "leave as is"; a due date is removed only by {@code clearDueDate}, a recurrence only
 * by {@code clearRecurrence}.
 */
public record TaskEdit(
    String title,
    String notes,
    LocalDate dueDate,
    boolean clearDueDate,
    Recurrence recurrence,
    boolean clearRecurrence) {

  public TaskEdit {
    if (clearDueDate && dueDate != null) {
      throw new IllegalArgumentException("Either set a due date or clear it, not both");
    }
    if (clearRecurrence && recurrence != null) {
      throw new IllegalArgumentException("Either set a repeat or clear it, not both");
    }
  }
}
