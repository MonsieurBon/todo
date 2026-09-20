package ch.ethy.todo.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
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
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
    name = "task",
    indexes = @Index(name = "idx_task_list_zone_state", columnList = "task_list_id, zone, state"),
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_task_list_client_ref",
            columnNames = {"task_list_id", "client_ref"}))
public class Task {

  public static final int MAX_TITLE_LENGTH = 255;
  public static final int MAX_LABEL_LENGTH = 64;
  public static final int MAX_CLIENT_REF_LENGTH = 64;

  public static final int MAX_NOTES_LENGTH = 10_000;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "task_list_id", nullable = false)
  private TaskList taskList;

  /**
   * Set by the web app for offline captures. A replayed create cannot tell a lost request from a
   * lost response; matching on this turns the second one into a lookup instead of a duplicate.
   */
  @Column(name = "client_ref", length = MAX_CLIENT_REF_LENGTH, updatable = false)
  private String clientRef;

  @Column(nullable = false, length = MAX_TITLE_LENGTH)
  private String title;

  @Column(columnDefinition = "text")
  private String notes;

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

  /** Strings rather than an entity: a label with an owner has no clean answer on a shared list. */
  @ElementCollection(fetch = FetchType.LAZY)
  @CollectionTable(name = "task_label", joinColumns = @JoinColumn(name = "task_id"))
  @Column(name = "label", nullable = false, length = MAX_LABEL_LENGTH)
  private Set<String> labels = new LinkedHashSet<>();

  /** Manual ordering within a zone. Lower sorts first. */
  @Column(name = "sort_order", nullable = false)
  private int position;

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

  public String clientRef() {
    return clientRef;
  }

  /** Blank is treated as absent: an empty string would deduplicate every task against itself. */
  public void clientRef(String clientRef) {
    mustBeOpen();
    this.clientRef =
        clientRef == null || clientRef.isBlank()
            ? null
            : Lengths.atMost(MAX_CLIENT_REF_LENGTH, "A client reference", clientRef.trim());
  }

  public int position() {
    return position;
  }

  public void position(int position) {
    mustBeOpen();
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
    mustBeOpen();
    if (title == null || title.isBlank()) {
      throw new IllegalArgumentException("A task needs a title");
    }
    this.title = Lengths.atMost(MAX_TITLE_LENGTH, "A task title", title.trim());
  }

  public String notes() {
    return notes;
  }

  public void notes(String notes) {
    mustBeOpen();
    this.notes = notes == null ? null : Lengths.atMost(MAX_NOTES_LENGTH, "Notes", notes);
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
    mustBeOpen();
    this.dueDate = dueDate;
  }

  public boolean isOpen() {
    return state == TaskState.TODO;
  }

  /** Refuses any change to a completed task; {@link #reopen()} is the way back. */
  private void mustBeOpen() {
    if (!isOpen()) {
      throw new TaskCompletedException(
          "Task " + id + " is completed; reopen it before changing it");
    }
  }

  public void complete() {
    this.state = TaskState.DONE;
    this.deferUntil = null;
  }

  public void reopen() {
    this.state = TaskState.TODO;
  }

  public final void moveTo(TaskZone zone) {
    mustBeOpen();
    if (zone == null) {
      throw new IllegalArgumentException("A task needs a zone");
    }
    this.zone = zone;
    this.deferUntil = null;
  }

  public void deferUntil(LocalDate until) {
    deferUntil(until, LocalDate.now());
  }

  public void deferUntil(LocalDate until, LocalDate today) {
    mustBeOpen();
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
    mustBeOpen();
    this.deferUntil = null;
  }

  public boolean isVisibleOn(LocalDate today) {
    return deferUntil == null || !deferUntil.isAfter(today);
  }

  public Set<String> labels() {
    return java.util.Collections.unmodifiableSet(labels);
  }

  public void addLabel(String label) {
    mustBeOpen();
    labels.add(normalise(label));
  }

  public void removeLabel(String label) {
    mustBeOpen();
    labels.remove(normalise(label));
  }

  public boolean hasLabel(String label) {
    return labels.contains(normalise(label));
  }

  public void labels(Collection<String> replacements) {
    mustBeOpen();
    Set<String> next = new LinkedHashSet<>();
    replacements.forEach(label -> next.add(normalise(label)));
    labels.clear();
    labels.addAll(next);
  }

  private static String normalise(String label) {
    if (label == null || label.isBlank()) {
      throw new IllegalArgumentException("A label needs a name");
    }
    return Lengths.atMost(MAX_LABEL_LENGTH, "A label", Slug.of(label));
  }

  public void markReviewed(Instant at) {
    mustBeOpen();
    this.lastReviewedAt = at;
  }

  public boolean isReviewDue(Instant now) {
    return zone.reviewInterval()
        .map(interval -> lastReviewedAt == null || !lastReviewedAt.plus(interval).isAfter(now))
        .orElse(false);
  }
}
