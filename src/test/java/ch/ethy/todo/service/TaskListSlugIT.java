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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * How a list's slug is derived — the part of naming a list that nobody types and everybody links
 * to, so it must not move on its own.
 */
class TaskListSlugIT extends IntegrationTest {

  @Autowired private TaskListService lists;
  @Autowired private CurrentUserService currentUser;

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  private User someone() {
    String subject = "slug-" + System.nanoTime();
    Jwt jwt =
        Jwt.withTokenValue("test")
            .header("alg", "none")
            .subject(subject)
            .claim("email", subject + "@example.com")
            .build();
    var auth =
        new TestingAuthenticationToken(
            jwt, null, List.of(new SimpleGrantedAuthority("SCOPE_todo:admin")));
    auth.setAuthenticated(true);
    SecurityContextHolder.getContext().setAuthentication(auth);
    return currentUser.current();
  }

  @Test
  @DisplayName("two names that slug the same get distinct slugs")
  void collisionsGetASuffix() {
    User me = someone();
    TaskList first = lists.create(me, "Project A");
    TaskList second = lists.create(me, "project-a!");

    assertThat(first.slug()).isEqualTo("project-a");
    assertThat(second.slug()).isEqualTo("project-a-2");
  }

  @Test
  @DisplayName("renaming a list to a name that slugs the same leaves its slug alone")
  void renameDoesNotWalkItsOwnSlug() {
    User me = someone();
    TaskList list = lists.create(me, "Personal");
    assertThat(list.slug()).isEqualTo("personal");

    lists.rename(list.id(), me, "personal");
    assertThat(lists.owned(list.id(), me).slug())
        .as("a rename that does not change the slug must not change the URL")
        .isEqualTo("personal");

    lists.rename(list.id(), me, "Personal ");
    assertThat(lists.owned(list.id(), me).slug()).isEqualTo("personal");
  }

  /**
   * The name constraint is the one remaining way a raw insert statement reached an MCP caller:
   * Hibernate must insert immediately for an identity key, so the driver answers before anything
   * else can. Both entry points are checked, and the message names the list rather than the
   * constraint.
   */
  @Test
  @DisplayName("creating a list under a name already taken is refused, with no statement in it")
  void duplicateNameOnCreate() {
    User me = someone();
    lists.create(me, "Household");

    assertThatThrownBy(() -> lists.create(me, "Household"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Household")
        // No cause means the check refused it rather than the constraint. The two say different
        // things on purpose: the check knows it was the name, the race cannot and does not claim
        // to. This also means the driver's exception never happened, so the transaction is not
        // left rollback-only for a case we saw coming.
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

  // The slug is derived before the entity sees the name, so without a null guard in Slug the
  // caller gets an NPE instead of the domain's message. MCP hands its argument straight here.
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

  @Test
  @DisplayName("renaming onto another list's slug still yields a distinct one")
  void renameStillAvoidsOthers() {
    User me = someone();
    lists.create(me, "Household");
    TaskList other = lists.create(me, "Garden");

    // A different name — the name constraint collates case-insensitively — that slugs the same.
    lists.rename(other.id(), me, "Household!");

    assertThat(lists.owned(other.id(), me).slug()).isEqualTo("household-2");
  }
}
