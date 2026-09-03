package ch.ethy.todo.service;

import ch.ethy.todo.domain.Slug;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.TaskListRepository;
import ch.ethy.todo.repository.UserRepository;
import java.util.List;
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
    return lists.save(new TaskList(owner, name, uniqueSlug(owner, name)));
  }

  public TaskList rename(Long id, User owner, String name) {
    TaskList list = owned(id, owner);
    list.name(name);
    list.slug(uniqueSlug(owner, name));
    return list;
  }

  public void delete(Long id, User owner) {
    lists.delete(owned(id, owner));
  }

  public TaskList share(Long id, User owner, String email) {
    TaskList list = owned(id, owner);
    User target =
        users
            .findByEmail(email)
            .orElseThrow(() -> new NotFoundException("No user with email " + email));
    list.share(target);
    return list;
  }

  public TaskList unshare(Long id, User owner, String email) {
    TaskList list = owned(id, owner);
    users.findByEmail(email).ifPresent(list::unshare);
    return list;
  }

  /** Slugs are unique per owner, so a repeat name gets a numeric suffix rather than a 500. */
  private String uniqueSlug(User owner, String name) {
    String base = Slug.of(name);
    String candidate = base;
    int suffix = 2;
    while (lists.findByOwnerAndSlug(owner, candidate).isPresent()) {
      candidate = base + "-" + suffix++;
    }
    return candidate;
  }

  private static NotFoundException notFound(Long id) {
    return new NotFoundException("No list " + id);
  }
}
