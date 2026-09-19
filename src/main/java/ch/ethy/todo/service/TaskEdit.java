package ch.ethy.todo.service;

import java.time.LocalDate;

/** Null means "leave as is"; a due date is removed only by {@code clearDueDate}. */
public record TaskEdit(String title, String notes, LocalDate dueDate, boolean clearDueDate) {

  public TaskEdit {
    if (clearDueDate && dueDate != null) {
      throw new IllegalArgumentException("Either set a due date or clear it, not both");
    }
  }
}
