package ch.ethy.todo.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.ethy.todo.IntegrationTest;
import ch.ethy.todo.domain.TaskState;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.service.NotFoundException;
import java.time.LocalDate;
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
 * What the MCP tools can actually put on a task, and read back.
 *
 * <p>Separate from {@link McpToolAuthorizationIT}, which is about the scope gate and nothing else.
 * These assert field plumbing: that an assistant reaches every field a person can set, and that an
 * edit changes only what it names. The failure they exist to catch is silent — a field accepted by
 * the tool and dropped before the database, which no scope test would notice.
 */
class McpTaskFieldsIT extends IntegrationTest {

  @Autowired private TodoTools tools;

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  /** Authenticates as a person holding every scope, as the resource server would. */
  private static void as(String subject) {
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

  private static String someone() {
    return "mcp-fields-" + System.nanoTime();
  }

  @Test
  @DisplayName("every field a task has can be set on one call")
  void createsWithEveryField() {
    as(someone());
    String topic = "complete-" + System.nanoTime();
    var list = tools.createTaskList("Roof " + System.nanoTime());

    var task =
        tools.createTask(
            "Fix the tile",
            "The cracked one above the porch.",
            TaskZone.CRITICAL_NOW,
            LocalDate.of(2026, 10, 1),
            List.of(topic, "house"),
            list.id());

    assertThat(task.title()).isEqualTo("Fix the tile");
    assertThat(task.notes()).isEqualTo("The cracked one above the porch.");
    assertThat(task.zone()).isEqualTo(TaskZone.CRITICAL_NOW);
    assertThat(task.dueDate()).isEqualTo(LocalDate.of(2026, 10, 1));
    assertThat(task.labels()).containsExactlyInAnyOrder(topic, "house");
    assertThat(task.listId()).isEqualTo(list.id());
  }

  @Test
  @DisplayName("notes can be filed and revised later")
  void carriesNotes() {
    as(someone());
    String topic = "notes-" + System.nanoTime();

    var task =
        tools.createTask(
            "Fix the tile",
            "The cracked one above the porch.",
            TaskZone.OPPORTUNITY_NOW,
            null,
            List.of(topic),
            null);
    assertThat(task.notes()).isEqualTo("The cracked one above the porch.");

    tools.updateTask(task.id(), null, "Ridge tile, not the porch one.", null);

    assertThat(tools.getBoard(topic, null, null, null).tasks())
        .as("an assistant must be able to read back what it wrote")
        .singleElement()
        .satisfies(
            t -> {
              assertThat(t.title()).isEqualTo("Fix the tile");
              assertThat(t.notes()).isEqualTo("Ridge tile, not the porch one.");
            });
  }

  @Test
  @DisplayName("an edit leaves out what it does not mention")
  void editIsPartial() {
    as(someone());
    String topic = "partial-" + System.nanoTime();

    var task =
        tools.createTask("Original title", "Original notes", null, null, List.of(topic), null);
    tools.updateTask(task.id(), "Better title", null, LocalDate.of(2026, 10, 1));

    assertThat(tools.getBoard(topic, null, null, null).tasks())
        .singleElement()
        .satisfies(
            t -> {
              assertThat(t.title()).isEqualTo("Better title");
              assertThat(t.notes()).isEqualTo("Original notes");
              assertThat(t.dueDate()).isEqualTo(LocalDate.of(2026, 10, 1));
            });
  }

  @Test
  @DisplayName("another person's task cannot be edited, and the refusal says only that")
  void cannotEditSomeoneElsesTask() {
    String owner = someone();
    String topic = "hers-" + System.nanoTime();
    as(owner);
    var hers = tools.createTask("Her roof", "Private.", null, null, List.of(topic), null);

    as(someone());
    assertThatThrownBy(() -> tools.updateTask(hers.id(), "hijacked", "hijacked", null))
        .as("a different answer would confirm the id exists")
        .isInstanceOf(NotFoundException.class)
        .hasMessageNotContaining("Her roof");

    as(owner);
    assertThat(tools.getBoard(topic, null, null, null).tasks())
        .as("the refused edit wrote nothing")
        .singleElement()
        .satisfies(
            t -> {
              assertThat(t.title()).isEqualTo("Her roof");
              assertThat(t.notes()).isEqualTo("Private.");
            });
  }

  @Test
  @DisplayName("an oversized note is refused rather than truncated on its way to the column")
  void refusesOversizedNotes() {
    as(someone());
    assertThatThrownBy(
            () ->
                tools.createTask("Fine", "x".repeat(10_001), null, null, List.of("too-long"), null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("10000");
  }

  @Test
  @DisplayName("a completion can be undone, and the task is readable while it is done")
  void canReopen() {
    as(someone());
    String topic = "reopen-" + System.nanoTime();

    var task = tools.createTask("Cancel the skip", null, null, null, List.of(topic), null);
    tools.completeTask(task.id());
    assertThat(tools.getBoard(topic, null, null, null).tasks()).isEmpty();
    assertThat(tools.getTask(task.id()).state())
        .as("get_task is the only tool that still reaches a completed task")
        .isEqualTo(TaskState.DONE);

    var reopened = tools.reopenTask(task.id());
    assertThat(reopened.state()).isEqualTo(TaskState.TODO);
    assertThat(tools.getBoard(topic, null, null, null).tasks())
        .extracting(t -> t.title())
        .containsExactly("Cancel the skip");
  }

  @Test
  @DisplayName("a deferred task is off the board but still readable by id")
  void readsWhatTheBoardHides() {
    as(someone());
    String topic = "hidden-" + System.nanoTime();

    var task =
        tools.createTask(
            "Renew the permit", "Office opens in March.", null, null, List.of(topic), null);
    tools.deferTask(task.id(), LocalDate.now().plusMonths(6));

    assertThat(tools.getBoard(topic, null, null, null).tasks())
        .as("a deferred task is out of sight, which is the point of deferring")
        .isEmpty();
    assertThat(tools.getTask(task.id()))
        .satisfies(
            t -> {
              assertThat(t.title()).isEqualTo("Renew the permit");
              assertThat(t.notes()).isEqualTo("Office opens in March.");
              assertThat(t.deferUntil()).isNotNull();
            });
  }

  @Test
  @DisplayName("a completed task is findable with includeDone, which is how its id is recovered")
  void completedIsFindableWithIncludeDone() {
    as(someone());
    String topic = "done-" + System.nanoTime();

    var task = tools.createTask("Cancel the skip", null, null, null, List.of(topic), null);
    tools.completeTask(task.id());

    assertThat(tools.getBoard(topic, null, null, null).tasks()).isEmpty();
    assertThat(tools.getBoard(topic, null, null, true).tasks())
        .as("reopen_task's description sends the model here to find an id it does not have")
        .extracting(t -> t.id())
        .containsExactly(task.id());
  }

  @Test
  @DisplayName("a reopened task stays hidden if its deferral outlived the completion")
  void reopenKeepsADeferral() {
    as(someone());
    String topic = "deferred-reopen-" + System.nanoTime();

    var task = tools.createTask("Renew the permit", null, null, null, List.of(topic), null);
    tools.deferTask(task.id(), LocalDate.now().plusMonths(6));
    tools.completeTask(task.id());
    tools.reopenTask(task.id());

    assertThat(tools.getTask(task.id()).state()).isEqualTo(TaskState.TODO);
    assertThat(tools.getBoard(topic, null, null, null).tasks())
        .as("reopening restores the state, not the visibility — the deferral survives")
        .isEmpty();
  }
}
