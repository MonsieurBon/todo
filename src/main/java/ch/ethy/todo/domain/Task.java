package ch.ethy.todo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * A single item on a One Minute To-Do List.
 *
 * <p>Deferral is the method's "not yet" move: it pushes an item over the horizon and hides it until
 * the chosen date, so the visible list stays honest. It is deliberately not the same thing as a due
 * date — {@code deferUntil} says when you want to see this again, {@code dueDate} says when it must
 * be finished, and most tasks have one without the other.
 */
@Entity
@Table(
    name = "task",
    indexes = @Index(name = "idx_task_list_zone_state", columnList = "task_list_id, zone, state"))
public class Task {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "task_list_id", nullable = false)
  private TaskList taskList;

  @Column(nullable = false)
  private String title;

  @Column(columnDefinition = "text")
  private String notes;

  // Stored as a string, not an ordinal: reordering the enum must never silently
  // reinterpret every row already in the table.
  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 32)
  private TaskZone zone;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private TaskState state = TaskState.TODO;

  @Column(name = "defer_until")
  private LocalDate deferUntil;

  @Column(name = "due_date")
  private LocalDate dueDate;

  /** Manual ordering within a zone. Lower sorts first. */
  @Column(name = "sort_order", nullable = false)
  private int position;

  /** When this task was last looked at during a review sweep. */
  @Column(name = "last_reviewed_at")
  private Instant lastReviewedAt;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected Task() {
    // for JPA
  }

  public Task(String title, TaskZone zone) {
    title(title);
    moveTo(zone);
  }

  public Long id() {
    return id;
  }

  public TaskList taskList() {
    return taskList;
  }

  void assignTo(TaskList taskList) {
    this.taskList = taskList;
  }

  public int position() {
    return position;
  }

  public void position(int position) {
    this.position = position;
  }

  public Instant lastReviewedAt() {
    return lastReviewedAt;
  }

  public Instant createdAt() {
    return createdAt;
  }

  public Instant updatedAt() {
    return updatedAt;
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

  /** Records that this task was considered during a review sweep. */
  public void markReviewed(Instant at) {
    this.lastReviewedAt = at;
  }

  /**
   * Whether this task is due to be swept again, per its zone's cadence. Critical Now has no cadence
   * because it is worked continuously, so a task there is never "due for review".
   */
  public boolean isReviewDue(Instant now) {
    return zone.reviewInterval()
        .map(interval -> lastReviewedAt == null || !lastReviewedAt.plus(interval).isAfter(now))
        .orElse(false);
  }
}
