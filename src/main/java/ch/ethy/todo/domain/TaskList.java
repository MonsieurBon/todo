package ch.ethy.todo.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(
    name = "task_list",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_task_list_owner_name",
            columnNames = {"owner_id", "name"}))
public class TaskList {

  public static final int MAX_NAME_LENGTH = 255;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  // Eager: open-in-view is off, so a lazy owner cannot be resolved during DTO assembly.
  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "owner_id", nullable = false)
  private User owner;

  @Column(nullable = false, length = MAX_NAME_LENGTH)
  private String name;

  /** Where a capture that names no list goes. Every user has exactly one. */
  @Column(name = "is_inbox", nullable = false)
  private boolean inbox;

  @ManyToMany(fetch = FetchType.LAZY)
  @JoinTable(
      name = "task_list_member",
      joinColumns = @JoinColumn(name = "task_list_id"),
      inverseJoinColumns = @JoinColumn(name = "user_id"))
  private Set<User> members = new LinkedHashSet<>();

  @OneToMany(mappedBy = "taskList", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<Task> tasks = new java.util.ArrayList<>();

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected TaskList() {
    // for JPA
  }

  public TaskList(User owner, String name) {
    if (owner == null) {
      throw new IllegalArgumentException("A list needs an owner");
    }
    this.owner = owner;
    name(name);
  }

  public Long id() {
    return id;
  }

  public User owner() {
    return owner;
  }

  public String name() {
    return name;
  }

  public final void name(String name) {
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("A list needs a name");
    }
    this.name = Lengths.atMost(MAX_NAME_LENGTH, "A list name", name.trim());
  }

  public boolean isInbox() {
    return inbox;
  }

  public void markAsInbox() {
    this.inbox = true;
  }

  public Set<User> members() {
    return Set.copyOf(members);
  }

  public List<Task> tasks() {
    return List.copyOf(tasks);
  }

  public boolean isAccessibleBy(User user) {
    return isOwnedBy(user) || members.contains(user);
  }

  public boolean isOwnedBy(User user) {
    return user != null && owner.id() != null && owner.id().equals(user.id());
  }

  public void share(User user) {
    if (!isOwnedBy(user)) {
      members.add(user);
    }
  }

  public void unshare(User user) {
    members.remove(user);
  }

  public void add(Task task) {
    tasks.add(task);
    task.assignTo(this);
  }

  public void remove(Task task) {
    tasks.remove(task);
  }
}
