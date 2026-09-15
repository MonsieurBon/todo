package ch.ethy.todo.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.ethy.todo.IntegrationTest;
import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.TaskZone;
import java.util.List;
import org.assertj.core.api.AbstractThrowableAssert;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * What the MCP tools do with input the database cannot store.
 *
 * <p>The tools take their arguments straight into the domain, so the request DTOs' {@code @Size}
 * constraints never run on this path. Without a bound on the entity itself, an over-long title
 * reached the driver and came back as a truncation error quoting the insert statement — a 500 that
 * told the caller nothing it could act on and told it something about the schema it should not
 * have. These assert the boundary holds where it is actually reached.
 */
class McpToolInputIT extends IntegrationTest {

  @Autowired private TodoTools tools;

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  private static void asFullyAuthorised() {
    String subject = "mcp-input-" + System.nanoTime();
    Jwt jwt =
        Jwt.withTokenValue("test")
            .header("alg", "none")
            .subject(subject)
            .claim("email", subject + "@example.com")
            .build();
    var auth =
        new TestingAuthenticationToken(
            jwt,
            null,
            List.of(
                new SimpleGrantedAuthority("SCOPE_todo:read"),
                new SimpleGrantedAuthority("SCOPE_todo:write"),
                new SimpleGrantedAuthority("SCOPE_todo:admin")));
    auth.setAuthenticated(true);
    SecurityContextHolder.getContext().setAuthentication(auth);
  }

  /** The message must name the limit, and must not carry the statement that would have run. */
  private static AbstractThrowableAssert<?, ? extends Throwable> rejectedNaming(
      int limit, ThrowingCallable call) {
    return assertThatThrownBy(call)
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining(String.valueOf(limit))
        .satisfies(
            e ->
                assertThat(e.getMessage().toLowerCase(java.util.Locale.ROOT))
                    .as("a client must not be told the statement or the driver's opinion of it")
                    .doesNotContain("insert")
                    .doesNotContain("truncat")
                    .doesNotContain("sql"));
  }

  @Test
  @DisplayName("create_task refuses a title longer than the column and names the limit")
  void titleTooLong() {
    asFullyAuthorised();
    rejectedNaming(
        Task.MAX_TITLE_LENGTH,
        () ->
            tools.createTask(
                "t".repeat(Task.MAX_TITLE_LENGTH + 1), TaskZone.OPPORTUNITY_NOW, null, null));
  }

  @Test
  @DisplayName("create_task refuses a label longer than the column and names the limit")
  void labelTooLong() {
    asFullyAuthorised();
    rejectedNaming(
        Task.MAX_LABEL_LENGTH,
        () ->
            tools.createTask(
                "Fix the roof",
                TaskZone.OPPORTUNITY_NOW,
                List.of("l".repeat(Task.MAX_LABEL_LENGTH + 1)),
                null));
  }

  @Test
  @DisplayName("set_task_labels refuses a label longer than the column")
  void setLabelsTooLong() {
    asFullyAuthorised();
    var task = tools.createTask("Fix the roof", TaskZone.OPPORTUNITY_NOW, null, null);
    rejectedNaming(
        Task.MAX_LABEL_LENGTH,
        () -> tools.setTaskLabels(task.id(), List.of("l".repeat(Task.MAX_LABEL_LENGTH + 1))));
  }

  @Test
  @DisplayName("create_tasklist refuses a name longer than the column and names the limit")
  void listNameTooLong() {
    asFullyAuthorised();
    rejectedNaming(
        TaskList.MAX_NAME_LENGTH,
        () -> tools.createTaskList("n".repeat(TaskList.MAX_NAME_LENGTH + 1)));
  }

  @Test
  @DisplayName("a name at the limit is stored, slug and all")
  void listNameAtTheLimitIsStored() {
    asFullyAuthorised();
    String name = "Household " + "x".repeat(TaskList.MAX_NAME_LENGTH - 10);
    var created = tools.createTaskList(name);
    assertThat(created.name()).isEqualTo(name);
    assertThat(created.slug()).hasSizeLessThanOrEqualTo(TaskList.MAX_SLUG_LENGTH);
    assertThat(tools.listTaskLists()).extracting(l -> l.name()).contains(name);
  }

  /**
   * Two different names that shorten to the same slug. This is the only way to <em>observe</em> the
   * suffix loop for a name long enough to be shortened: the same name twice does run the loop, but
   * the insert then fails on the unique (owner, name) constraint before the slug it computed is
   * ever used. The loop is where the arithmetic keeping a suffixed slug inside its column lives.
   */
  @Test
  @DisplayName("a second name that shortens to the same slug gets a distinct one that still fits")
  void shortenedSlugsStayUniqueAndFit() {
    asFullyAuthorised();
    String name = "s".repeat(TaskList.MAX_NAME_LENGTH);
    String collides = "s".repeat(TaskList.MAX_NAME_LENGTH - 5) + " tail";

    var first = tools.createTaskList(name);
    var second = tools.createTaskList(collides);

    assertThat(first.slug()).hasSize(TaskList.MAX_SLUG_LENGTH);
    assertThat(second.slug())
        .isNotEqualTo(first.slug())
        .hasSizeLessThanOrEqualTo(TaskList.MAX_SLUG_LENGTH);
  }

  @Test
  @DisplayName("input at the limit is accepted, so the check is not off by one")
  void atTheLimitIsAccepted() {
    asFullyAuthorised();
    assertThatCode(
            () ->
                tools.createTask(
                    "t".repeat(Task.MAX_TITLE_LENGTH),
                    TaskZone.OPPORTUNITY_NOW,
                    List.of("l".repeat(Task.MAX_LABEL_LENGTH)),
                    null))
        .doesNotThrowAnyException();
  }
}
