package ch.ethy.todo.domain;

import java.time.LocalDate;

/**
 * A single item on a One Minute To-Do List.
 *
 * <p>Deferral is the method's "not yet" move: it pushes an item over the horizon and hides it until
 * the chosen date, so the visible list stays honest. It is deliberately not the same thing as a due
 * date — {@code deferUntil} says when you want to see this again, {@code dueDate} says when it must
 * be finished, and most tasks have one without the other.
 */
public class Task {

  private String title;
  private String notes;
  private TaskZone zone;
  private TaskState state = TaskState.TODO;
  private LocalDate deferUntil;
  private LocalDate dueDate;

  public Task(String title, TaskZone zone) {
    title(title);
    moveTo(zone);
  }

  public String title() {
    return title;
  }

  public final void title(String title) {
    if (title == null || title.isBlank()) {
      throw new IllegalArgumentException("A task needs a title");
    }
    this.title = title.trim();
  }

  public String notes() {
    return notes;
  }

  public void notes(String notes) {
    this.notes = notes;
  }

  public TaskZone zone() {
    return zone;
  }

  public TaskState state() {
    return state;
  }

  public LocalDate deferUntil() {
    return deferUntil;
  }

  public LocalDate dueDate() {
    return dueDate;
  }

  public void dueDate(LocalDate dueDate) {
    this.dueDate = dueDate;
  }

  public boolean isOpen() {
    return state == TaskState.TODO;
  }

  public void complete() {
    this.state = TaskState.DONE;
  }

  public void reopen() {
    this.state = TaskState.TODO;
  }

  /**
   * Moves the task to another zone. Any deferral is cleared: deciding a task belongs in a zone is
   * an act of attention, which is exactly what deferring it postponed.
   */
  public final void moveTo(TaskZone zone) {
    if (zone == null) {
      throw new IllegalArgumentException("A task needs a zone");
    }
    this.zone = zone;
    this.deferUntil = null;
  }

  /** Defers the task relative to the system clock. */
  public void deferUntil(LocalDate until) {
    deferUntil(until, LocalDate.now());
  }

  /**
   * Defers the task until {@code until}, pushing it over the horizon. Deferring into the past would
   * be indistinguishable from not deferring at all, so it is rejected rather than silently ignored.
   */
  public void deferUntil(LocalDate until, LocalDate today) {
    if (until == null) {
      throw new IllegalArgumentException("A deferral needs a date");
    }
    if (until.isBefore(today)) {
      throw new IllegalArgumentException("Cannot defer into the past: " + until);
    }
    this.zone = TaskZone.OVER_THE_HORIZON;
    this.deferUntil = until;
  }

  public void clearDeferral() {
    this.deferUntil = null;
  }

  /**
   * A deferred task stays out of sight until the day it is due back, and is visible from then on.
   */
  public boolean isVisibleOn(LocalDate today) {
    return deferUntil == null || !deferUntil.isAfter(today);
  }
}
