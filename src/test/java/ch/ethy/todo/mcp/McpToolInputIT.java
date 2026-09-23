package ch.ethy.todo.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.ethy.todo.IntegrationTest;
import ch.ethy.todo.domain.Task;
import ch.ethy.todo.domain.TaskCompletedException;
import ch.ethy.todo.domain.TaskList;
import ch.ethy.todo.domain.TaskZone;
import java.time.LocalDate;
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
                "t".repeat(Task.MAX_TITLE_LENGTH + 1),
                TaskZone.OPPORTUNITY_NOW,
                null,
                null,
                null,
                null));
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
                null,
                null,
                null));
  }

  @Test
  @DisplayName("create_task refuses notes longer than the column and names the limit")
  void notesTooLong() {
    asSomeone();
    rejectedNaming(
        Task.MAX_NOTES_LENGTH,
        () ->
            tools.createTask(
                "Fix the roof",
                TaskZone.OPPORTUNITY_NOW,
                null,
                null,
                "n".repeat(Task.MAX_NOTES_LENGTH + 1),
                null));
  }

  @Test
  @DisplayName("update_task refuses a title or notes longer than the column")
  void updateTooLong() {
    asSomeone();
    var task = tools.createTask("Fix the roof", TaskZone.OPPORTUNITY_NOW, null, null, null, null);
    rejectedNaming(
        Task.MAX_TITLE_LENGTH,
        () -> tools.updateTask(task.id(), "t".repeat(Task.MAX_TITLE_LENGTH + 1), null, null, null));
    rejectedNaming(
        Task.MAX_NOTES_LENGTH,
        () -> tools.updateTask(task.id(), null, "n".repeat(Task.MAX_NOTES_LENGTH + 1), null, null));
  }

  @Test
  @DisplayName("a refused update_task applies none of its fields, so a retry starts clean")
  void refusedUpdateAppliesNothing() {
    asSomeone();
    var task = tools.createTask("Fix the roof", TaskZone.OPPORTUNITY_NOW, null, null, null, null);
    rejectedNaming(
        Task.MAX_NOTES_LENGTH,
        () ->
            tools.updateTask(
                task.id(),
                "Fix the ridge tile",
                "n".repeat(Task.MAX_NOTES_LENGTH + 1),
                null,
                null));
    assertThat(tools.getBoard(null, null, null, null).tasks())
        .filteredOn(t -> t.id().equals(task.id()))
        .singleElement()
        .satisfies(t -> assertThat(t.title()).isEqualTo("Fix the roof"));
  }

  @Test
  @DisplayName("update_task refuses a blank title, and a due date together with clearing it")
  void updateContradictions() {
    asSomeone();
    var task = tools.createTask("Fix the roof", TaskZone.OPPORTUNITY_NOW, null, null, null, null);
    assertThatThrownBy(() -> tools.updateTask(task.id(), " ", null, null, null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> tools.updateTask(task.id(), null, null, LocalDate.of(2030, 1, 1), true))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("set_task_labels refuses a label longer than the column")
  void setLabelsTooLong() {
    asSomeone();
    var task = tools.createTask("Fix the roof", TaskZone.OPPORTUNITY_NOW, null, null, null, null);
    rejectedNaming(
        Task.MAX_LABEL_LENGTH,
        () -> tools.setTaskLabels(task.id(), List.of("l".repeat(Task.MAX_LABEL_LENGTH + 1))));
  }

  @Test
  @DisplayName("every tool that changes a task refuses a completed one, and points at reopen_task")
  void completedTasksAreReadOnly() {
    asSomeone();
    var task =
        tools.createTask(
            "Fix the roof", TaskZone.OPPORTUNITY_NOW, List.of("house"), null, null, null);
    tools.completeTask(task.id());

    assertThat(
            List.<ThrowingCallable>of(
                () -> tools.updateTask(task.id(), "Fix the ridge", null, null, null),
                () -> tools.moveTaskZone(task.id(), TaskZone.CRITICAL_NOW),
                () -> tools.deferTask(task.id(), LocalDate.of(2030, 1, 1)),
                () -> tools.setTaskLabels(task.id(), List.of("garden")),
                () -> tools.markTaskReviewed(task.id())))
        .allSatisfy(
            call ->
                assertThatThrownBy(call)
                    .isInstanceOf(TaskCompletedException.class)
                    .hasMessageContaining("reopen"));

    assertThat(tools.getBoard(null, null, null, true).tasks())
        .filteredOn(t -> t.id().equals(task.id()))
        .singleElement()
        .satisfies(
            t -> {
              assertThat(t.title()).isEqualTo("Fix the roof");
              assertThat(t.zone()).isEqualTo(TaskZone.OPPORTUNITY_NOW);
              assertThat(t.deferUntil())
                  .as("a deferral slipped onto a done task would still hide it after reopening")
                  .isNull();
              assertThat(t.labels()).containsExactly("house");
            });
  }

  @Test
  @DisplayName("reopen_task is the way back: afterwards the tools take the task again")
  void reopeningRestoresTheTools() {
    asSomeone();
    var task = tools.createTask("Fix the roof", TaskZone.OPPORTUNITY_NOW, null, null, null, null);
    tools.completeTask(task.id());
    tools.reopenTask(task.id());

    assertThatCode(() -> tools.updateTask(task.id(), "Fix the ridge tile", null, null, null))
        .doesNotThrowAnyException();
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
  @DisplayName("a name at the limit is stored whole")
  void listNameAtTheLimitIsStored() {
    asSomeone();
    String name = "Household " + "x".repeat(TaskList.MAX_NAME_LENGTH - 10);
    var created = tools.createTaskList(name);
    assertThat(created.name()).isEqualTo(name);
    assertThat(tools.listTaskLists()).extracting(l -> l.name()).contains(name);
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
                    null,
                    "n".repeat(Task.MAX_NOTES_LENGTH),
                    null))
        .doesNotThrowAnyException();
  }
}
