package ch.ethy.todo.service;

import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.TaskListRepository;
import ch.ethy.todo.repository.UserRepository;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

  @Transactional(readOnly = true)
  public TaskList owned(Long id, User user) {
    return resolveOwned(id, user);
  }

  /** Outside the read-only transaction, so mutators keep a managed entity. */
  private TaskList resolveOwned(Long id, User user) {
    return lists.findByIdAndOwner(id, user).orElseThrow(() -> notFound(id));
  }

  @Transactional(readOnly = true)
  public TaskList inboxOf(User user) {
    return lists
        .findByOwnerAndInboxIsTrue(user)
        .orElseThrow(() -> new NotFoundException("No inbox for this user"));
  }

  public TaskList create(User owner, String name) {
    refuseADuplicateName(owner, name, null);
    return underAUniqueName(() -> lists.saveAndFlush(new TaskList(owner, name)));
  }

  public TaskList rename(Long id, User owner, String name) {
    TaskList list = resolveOwned(id, owner);
    refuseADuplicateName(owner, name, id);
    return underAUniqueName(
        () -> {
          list.name(name);
          // Flushed here, not at commit, so a refused name is attributable to this call.
          lists.flush();
          return list;
        });
  }

  /**
   * Checked up front so the duplicate is not found by the driver instead, whose message quotes the
   * constraint and the whole statement and reaches an MCP caller verbatim.
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

  /** The race the check above cannot cover. */
  private TaskList underAUniqueName(Supplier<TaskList> write) {
    try {
      return write.get();
    } catch (DataIntegrityViolationException raced) {
      throw new IllegalArgumentException(
          "Another of your lists took that name a moment earlier - try again", raced);
    }
  }

  private static String duplicate(String name) {
    return "A list called \"" + name.trim() + "\" already exists";
  }

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

  private static NotFoundException notFound(Long id) {
    return new NotFoundException("No list " + id);
  }
}
