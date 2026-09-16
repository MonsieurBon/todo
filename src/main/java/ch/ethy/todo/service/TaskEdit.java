package ch.ethy.todo.service;

import java.time.LocalDate;

/**
 * Null means "leave as is", so nothing can be cleared through this — emptying the due date in the
 * board's editor silently keeps the old one. Fixing that needs presence-vs-null on the request.
 */
public record TaskEdit(String title, String notes, LocalDate dueDate) {}
