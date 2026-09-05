package ch.ethy.todo.service;

import java.time.LocalDate;

/**
 * The editable face of a task: the fields a person can change without it being a move, a deferral
 * or a completion, each of which has its own operation because each has rules.
 *
 * <p>A null field means "leave this as it is", so a caller may send only what changed. The cost of
 * that convention is that no field can be cleared through it, and one caller already wants to: the
 * board's editor renders the due date as an emptiable input, so emptying it and saving silently
 * leaves the old date in place. Clearing needs a presence-vs-null distinction on the request —
 * three states per field, and a regenerated contract — so it is tracked separately rather than
 * smuggled in here.
 *
 * @see NewTask the same shape for a task that does not exist yet
 */
public record TaskEdit(String title, String notes, LocalDate dueDate) {

  public TaskEdit {
    TaskFields.checkTitle(title);
    TaskFields.checkNotes(notes);
  }
}
