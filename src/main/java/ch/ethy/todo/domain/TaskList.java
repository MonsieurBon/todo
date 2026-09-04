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

/**
 * A list of tasks, owned by one user and optionally shared with others.
 *
 * <p>Slugs are unique <em>per owner</em>. The previous version made them globally non-unique and
 * then resolved them by scanning every accessible list, so a list shared with you could shadow your
 * own list of the same name.
 */
@Entity
@Table(
    name = "task_list",
    uniqueConstraints = {
      @UniqueConstraint(
          name = "uq_task_list_owner_slug",
          columnNames = {"owner_id", "slug"}),
      @UniqueConstraint(
          name = "uq_task_list_owner_name",
          columnNames = {"owner_id", "name"})
    })
public class TaskList {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  // Eager: rendering any list needs to know whether the viewer owns it, and with
  // open-in-view disabled a lazy owner cannot be resolved during DTO assembly.
  @ManyToOne(fetch = FetchType.EAGER, optional = false)
  @JoinColumn(name = "owner_id", nullable = false)
  private User owner;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false, length = 128)
  private String slug;

  /**
   * The list a capture-only client files into when it names none. Such a client cannot read lists,
   * so it cannot pick one — every user therefore needs exactly one designated inbox.
   */
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

  public TaskList(User owner, String name, String slug) {
    if (owner == null) {
      throw new IllegalArgumentException("A list needs an owner");
    }
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("A list needs a name");
    }
    this.owner = owner;
    this.name = name.trim();
    this.slug = slug;
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

  public void name(String name) {
    this.name = name;
  }

  public String slug() {
    return slug;
  }

  public void slug(String slug) {
    this.slug = slug;
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

  /** Whether this user may see the list at all — either they own it or it was shared with them. */
  public boolean isAccessibleBy(User user) {
    return isOwnedBy(user) || members.contains(user);
  }

  /** Only the owner may rename, delete or share a list. */
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
