package ch.ethy.todo.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.ethy.todo.IntegrationTest;
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
}
