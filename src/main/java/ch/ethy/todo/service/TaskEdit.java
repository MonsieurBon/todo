package ch.ethy.todo.service;

import java.time.LocalDate;

/**
 * The editable face of a task: the fields a person can change without it being a move, a deferral
 * or a completion, each of which has its own operation because each has rules.
 *
 * <p>A null field means "leave this as it is", so a caller may send only what changed. The cost of
 * that convention is that no field can be cleared through it; nothing needs to yet, and a
 * clear-vs-omit distinction would mean three states per field.
 *
 * @see NewTask the same shape for a task that does not exist yet
 */
public record TaskEdit(String title, String notes, LocalDate dueDate) {}
