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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Input the database cannot store, on the path where the DTOs' {@code @Size} never runs: the tools
 * hand their arguments straight to the domain.
 */
class McpToolInputIT extends IntegrationTest {

  @Autowired private TodoTools tools;

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  private static void asSomeone() {
    String subject = "mcp-input-" + System.nanoTime();
    Jwt jwt =
        Jwt.withTokenValue("test")
            .header("alg", "none")
            .subject(subject)
            .claim("email", subject + "@example.com")
            .build();
    var auth = new TestingAuthenticationToken(jwt, null, List.of());
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
    asSomeone();
    rejectedNaming(
        Task.MAX_TITLE_LENGTH,
        () ->
            tools.createTask(
                "t".repeat(Task.MAX_TITLE_LENGTH + 1), TaskZone.OPPORTUNITY_NOW, null, null));
  }

  @Test
  @DisplayName("create_task refuses a label longer than the column and names the limit")
  void labelTooLong() {
    asSomeone();
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
    asSomeone();
    var task = tools.createTask("Fix the roof", TaskZone.OPPORTUNITY_NOW, null, null);
    rejectedNaming(
        Task.MAX_LABEL_LENGTH,
        () -> tools.setTaskLabels(task.id(), List.of("l".repeat(Task.MAX_LABEL_LENGTH + 1))));
  }

  @Test
  @DisplayName("create_tasklist refuses a name longer than the column and names the limit")
  void listNameTooLong() {
    asSomeone();
    rejectedNaming(
        TaskList.MAX_NAME_LENGTH,
        () -> tools.createTaskList("n".repeat(TaskList.MAX_NAME_LENGTH + 1)));
  }

  @Test
  @DisplayName("a name at the limit is stored, slug and all")
  void listNameAtTheLimitIsStored() {
    asSomeone();
    String name = "Household " + "x".repeat(TaskList.MAX_NAME_LENGTH - 10);
    var created = tools.createTaskList(name);
    assertThat(created.name()).isEqualTo(name);
    assertThat(created.slug()).hasSizeLessThanOrEqualTo(TaskList.MAX_SLUG_LENGTH);
    assertThat(tools.listTaskLists()).extracting(l -> l.name()).contains(name);
  }

  /**
   * Two different names on purpose: the same name twice fails on the unique (owner, name)
   * constraint before the slug it computed is ever used, so the suffix loop stays unobservable.
   */
  @Test
  @DisplayName("a second name that shortens to the same slug gets a distinct one that still fits")
  void shortenedSlugsStayUniqueAndFit() {
    asSomeone();
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
    asSomeone();
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
