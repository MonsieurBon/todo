package ch.ethy.todo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.ethy.todo.IntegrationTest;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.User;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * A list's name is unique per owner, and how the refusal reads matters: it is the only thing
 * standing between an MCP caller and the driver's own message.
 */
class TaskListNameIT extends IntegrationTest {

  @Autowired private TaskListService lists;
  @Autowired private CurrentUserService currentUser;

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  private User someone() {
    String subject = "name-" + System.nanoTime();
    Jwt jwt =
        Jwt.withTokenValue("test")
            .header("alg", "none")
            .subject(subject)
            .claim("email", subject + "@example.com")
            .build();
    var auth = new TestingAuthenticationToken(jwt, null, List.of());
    auth.setAuthenticated(true);
    SecurityContextHolder.getContext().setAuthentication(auth);
    return currentUser.current();
  }

  /**
   * Hibernate must insert immediately for an identity key, so without an up-front check the driver
   * answers first and its statement reaches the caller.
   */
  @Test
  @DisplayName("creating a list under a name already taken is refused, with no statement in it")
  void duplicateNameOnCreate() {
    User me = someone();
    lists.create(me, "Household");

    assertThatThrownBy(() -> lists.create(me, "Household"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Household")
        // No cause means the check refused it, not the constraint — so no driver exception
        // happened and the transaction is not rollback-only for a case we saw coming.
        .hasNoCause()
        .satisfies(
            e ->
                assertThat(e.getMessage().toLowerCase(java.util.Locale.ROOT))
                    .doesNotContain("insert")
                    .doesNotContain("duplicate entry")
                    .doesNotContain("constraint"));
  }

  @Test
  @DisplayName("renaming a list onto another's name is refused the same way")
  void duplicateNameOnRename() {
    User me = someone();
    lists.create(me, "Household");
    TaskList garden = lists.create(me, "Garden");

    assertThatThrownBy(() -> lists.rename(garden.id(), me, "Household"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Household")
        .hasNoCause();
  }

  @Test
  @DisplayName("renaming a list to the name it already has is not a duplicate")
  void renamingToItsOwnNameIsFine() {
    User me = someone();
    TaskList list = lists.create(me, "Household");

    assertThatCode(() -> lists.rename(list.id(), me, "Household")).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("a missing name is refused by the entity, not by a NullPointerException")
  void nullNameIsRefusedProperly() {
    User me = someone();
    assertThatThrownBy(() -> lists.create(me, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("needs a name");
  }

  @Test
  @DisplayName("a blank name is refused the same way")
  void blankNameIsRefusedProperly() {
    User me = someone();
    assertThatThrownBy(() -> lists.create(me, "   "))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("needs a name");
  }

  @Test
  @DisplayName("another user may hold the same name, because names are unique per owner")
  void namesAreScopedToTheOwner() {
    lists.create(someone(), "Household");
    assertThatCode(() -> lists.create(someone(), "Household")).doesNotThrowAnyException();
  }
}
