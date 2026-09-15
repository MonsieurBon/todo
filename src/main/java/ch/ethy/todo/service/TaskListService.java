package ch.ethy.todo.service;

import ch.ethy.todo.domain.Slug;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.TaskListRepository;
import ch.ethy.todo.repository.UserRepository;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every method that takes an id also takes the user, and resolves the two together through a scoped
 * query. There is deliberately no "load by id" helper on this service: the previous version of this
 * app had one, checked access afterwards, and leaked data whenever the check failed.
 */
@Service
@Transactional
public class TaskListService {

  private final TaskListRepository lists;
  private final UserRepository users;

  public TaskListService(TaskListRepository lists, UserRepository users) {
    this.lists = lists;
    this.users = users;
  }

  @Transactional(readOnly = true)
  public List<TaskList> visibleTo(User user) {
    return lists.findAllAccessibleBy(user);
  }

  @Transactional(readOnly = true)
  public TaskList accessible(Long id, User user) {
    return lists.findAccessible(id, user).orElseThrow(() -> notFound(id));
  }

  /** Owner-only: renaming, deleting and sharing are not things a member may do. */
  @Transactional(readOnly = true)
  public TaskList owned(Long id, User user) {
    return resolveOwned(id, user);
  }

  /**
   * The same lookup for this service's own use, outside the read-only transaction, so the entity
   * the mutators below change stays managed. See {@code TaskService.resolve} for why they do not
   * simply call the public one.
   */
  private TaskList resolveOwned(Long id, User user) {
    return lists.findByIdAndOwner(id, user).orElseThrow(() -> notFound(id));
  }

  @Transactional(readOnly = true)
  public TaskList bySlug(String slug, User user) {
    // Ordered so the user's own list wins over one shared with them under the same slug.
    return lists.findAccessibleBySlug(slug, user).stream()
        .findFirst()
        .orElseThrow(() -> new NotFoundException("No list '" + slug + "'"));
  }

  @Transactional(readOnly = true)
  public TaskList inboxOf(User user) {
    return lists
        .findByOwnerAndInboxIsTrue(user)
        .orElseThrow(() -> new NotFoundException("No inbox for this user"));
  }

  public TaskList create(User owner, String name) {
    refuseADuplicateName(owner, name, null);
    return underAUniqueName(
        () -> lists.saveAndFlush(new TaskList(owner, name, uniqueSlug(owner, name, null))));
  }

  public TaskList rename(Long id, User owner, String name) {
    TaskList list = resolveOwned(id, owner);
    refuseADuplicateName(owner, name, id);
    return underAUniqueName(
        () -> {
          list.name(name);
          list.slug(uniqueSlug(owner, name, id));
          // Flushed here rather than at commit so a name the constraint refuses is attributable
          // to this call, and can be answered as one.
          lists.flush();
          return list;
        });
  }

  /**
   * A name already taken by another of this owner's lists.
   *
   * <p>Without this the duplicate is found by the driver instead: Hibernate must insert immediately
   * for an identity key, so the constraint answers with its own name and the whole statement, and
   * that reaches an MCP caller verbatim — a failure it cannot act on, carrying schema detail it has
   * no business seeing.
   *
   * <p>A missing or blank name is not this method's complaint; the entity refuses it with its own
   * message.
   */
  private void refuseADuplicateName(User owner, String name, Long excluding) {
    if (name == null || name.isBlank()) {
      return;
    }
    lists
        .findByOwnerAndName(owner, name.trim())
        .filter(held -> !held.id().equals(excluding))
        .ifPresent(
            held -> {
              throw new IllegalArgumentException(duplicate(name));
            });
  }

  /**
   * The race neither check above can cover: two callers pass both, and the unique constraints are
   * the boundary that actually holds.
   *
   * <p>Two of them sit under this write — the name, and the slug derived from it — and a race can
   * trip either. Two different names that slug alike ("Project A" and "project-a!") clear the name
   * check honestly and collide on the slug. Which one it was is not knowable here without reading
   * driver text or re-reading in a transaction the violation has already marked rollback-only, so
   * the message says what is true of both rather than naming the name. It also gives the right
   * advice: retrying succeeds, because the loser's next slug sees the winner's.
   */
  private TaskList underAUniqueName(Supplier<TaskList> write) {
    try {
      return write.get();
    } catch (DataIntegrityViolationException raced) {
      throw new IllegalArgumentException(
          "Another of your lists took that name or its address a moment earlier - try again",
          raced);
    }
  }

  private static String duplicate(String name) {
    return "A list called \"" + name.trim() + "\" already exists";
  }

  /**
   * Deletes a list, except the inbox.
   *
   * <p>The inbox is where anything captured without naming a list goes, and nothing can create
   * another one — so deleting it does not remove a list, it permanently breaks capture for that
   * person. The web app already hides the option; this is the boundary that actually holds, since
   * the API is reachable without it.
   */
  public void delete(Long id, User owner) {
    TaskList list = resolveOwned(id, owner);
    if (list.isInbox()) {
      throw new IllegalArgumentException(
          "The inbox cannot be deleted - it is where anything captured without a list goes."
              + " Rename it instead.");
    }
    lists.delete(list);
  }

  public TaskList share(Long id, User owner, String email) {
    TaskList list = resolveOwned(id, owner);
    User target =
        users
            .findByEmail(email)
            .orElseThrow(() -> new NotFoundException("No user with email " + email));
    list.share(target);
    return list;
  }

  public TaskList unshare(Long id, User owner, String email) {
    TaskList list = resolveOwned(id, owner);
    users.findByEmail(email).ifPresent(list::unshare);
    return list;
  }

  /**
   * Slugs are unique per owner, so a repeat name gets a numeric suffix rather than a 500.
   *
   * <p>The slug column is narrower than the name column, and the slug is derived rather than given,
   * so a long name is shortened here instead of refused — the same loop that resolves a repeated
   * name resolves the collisions shortening creates.
   *
   * <p>{@code renaming} is the list the slug is for, or null when creating. A rename has already
   * applied the new name by this point, so without it the list collides with itself and walks its
   * own slug one suffix further on every no-op rename — changing its URL for a rename that changed
   * nothing.
   */
  private String uniqueSlug(User owner, String name, Long renaming) {
    String candidate = Slug.of(name, TaskList.MAX_SLUG_LENGTH);
    int suffix = 2;
    while (takenByAnother(owner, candidate, renaming)) {
      String tail = "-" + suffix++;
      candidate = Slug.of(name, TaskList.MAX_SLUG_LENGTH - tail.length()) + tail;
    }
    return candidate;
  }

  private boolean takenByAnother(User owner, String slug, Long renaming) {
    return lists
        .findByOwnerAndSlug(owner, slug)
        .filter(held -> !held.id().equals(renaming))
        .isPresent();
  }

  private static NotFoundException notFound(Long id) {
    return new NotFoundException("No list " + id);
  }
}
