package ch.ethy.todo.service;

import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.User;
import ch.ethy.todo.repository.TaskListRepository;
import ch.ethy.todo.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Provisions on demand, so no job has to synchronise accounts with the IdP. */
@Service
public class CurrentUserService {

  private final UserRepository users;
  private final TaskListRepository lists;

  public CurrentUserService(UserRepository users, TaskListRepository lists) {
    this.users = users;
    this.lists = lists;
  }

  @Transactional
  public User current() {
    Jwt jwt = jwt();
    return users.findByExternalId(jwt.getSubject()).orElseGet(() -> provision(jwt));
  }

  private static Jwt jwt() {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (principal instanceof Jwt jwt) {
      return jwt;
    }
    throw new IllegalStateException("Expected a JWT principal, got " + principal);
  }

  private User provision(Jwt jwt) {
    String email = claim(jwt, "email", jwt.getSubject());
    User user = new User(jwt.getSubject(), email, claim(jwt, "name", email));
    try {
      user = users.saveAndFlush(user);
    } catch (DataIntegrityViolationException raced) {
      // Two first-ever requests can arrive together; the unique constraint on external_id
      // settles it and the loser reads the winner's row.
      return users
          .findByExternalId(jwt.getSubject())
          .orElseThrow(() -> new IllegalStateException("User vanished after a provisioning race"));
    }

    // Created here because nothing else can: there is no endpoint that makes an inbox.
    TaskList inbox = new TaskList(user, "Inbox", "inbox");
    inbox.markAsInbox();
    lists.save(inbox);
    return user;
  }

  private static String claim(Jwt jwt, String name, String fallback) {
    String value = jwt.getClaimAsString(name);
    return value == null || value.isBlank() ? fallback : value;
  }
}
