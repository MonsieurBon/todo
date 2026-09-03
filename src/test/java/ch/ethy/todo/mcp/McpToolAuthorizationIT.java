package ch.ethy.todo.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.ethy.todo.domain.TaskZone;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The scope gate on every MCP tool.
 *
 * <p>scripts/verify-mcp.sh proves this end to end against a real Keycloak, but shell scripts do not
 * run in CI. This asserts the same invariant where it will actually be enforced on every push: a
 * capture-only assistant can file a task and do nothing else.
 *
 * <p>The tool list itself is <em>not</em> filtered per caller — the MCP SDK offers no hook for it —
 * so a restricted client sees tools it cannot call and gets Access Denied on use. Fixing that
 * properly means a second endpoint with its own tool set; until then these tests are the boundary.
 */
@SpringBootTest
@Testcontainers
class McpToolAuthorizationIT {

  @Container
  @SuppressWarnings("resource")
  static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4").withDatabaseName("todo");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
    registry.add("spring.datasource.username", MYSQL::getUsername);
    registry.add("spring.datasource.password", MYSQL::getPassword);
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @MockitoBean private JwtDecoder jwtDecoder;

  @Autowired private TodoTools tools;

  private static final String CAPTURE = "SCOPE_todo:capture";
  private static final String READ = "SCOPE_todo:read";
  private static final String WRITE = "SCOPE_todo:write";
  private static final String ADMIN = "SCOPE_todo:admin";

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  /** Authenticates as a person holding exactly these scopes, as the resource server would. */
  private static void as(String subject, String... authorities) {
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
            java.util.Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList());
    auth.setAuthenticated(true);
    SecurityContextHolder.getContext().setAuthentication(auth);
  }

  private static String someone() {
    return "mcp-subject-" + System.nanoTime();
  }

  /** Asserts a tool refuses outright rather than returning a partial or empty result. */
  private void refused(String what, Consumer<TodoTools> call) {
    assertThatThrownBy(() -> call.accept(tools))
        .as("%s must be refused", what)
        .isInstanceOf(AccessDeniedException.class);
  }

  @Nested
  @DisplayName("a capture-only assistant")
  class CaptureOnly {

    @Test
    @DisplayName("can file a task")
    void canCreate() {
      as(someone(), CAPTURE);
      assertThatCode(() -> tools.createTask("Buy roof tiles", null, List.of("house"), null))
          .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("cannot read anything")
    void cannotRead() {
      as(someone(), CAPTURE);
      refused("get_board", t -> t.getBoard(null, null, null, null));
      refused("list_labels", TodoTools::listLabels);
      refused("list_tasklists", TodoTools::listTaskLists);
      refused("get_review_queue", t -> t.getReviewQueue(1L));
    }

    @Test
    @DisplayName("cannot change or delete anything")
    void cannotWrite() {
      as(someone(), CAPTURE);
      refused("complete_task", t -> t.completeTask(1L));
      refused("move_task_zone", t -> t.moveTaskZone(1L, TaskZone.CRITICAL_NOW));
      refused("defer_task", t -> t.deferTask(1L, LocalDate.now().plusDays(1)));
      refused("set_task_labels", t -> t.setTaskLabels(1L, List.of("x")));
      refused("mark_task_reviewed", t -> t.markTaskReviewed(1L));
      refused("delete_task", t -> t.deleteTask(1L));
    }

    @Test
    @DisplayName("cannot manage lists")
    void cannotAdminister() {
      as(someone(), CAPTURE);
      refused("create_tasklist", t -> t.createTaskList("Sneaky"));
      refused("share_tasklist", t -> t.shareTaskList(1L, "someone@example.com"));
    }
  }

  @Nested
  @DisplayName("scopes do not imply one another")
  class NoImplication {

    @Test
    @DisplayName("read does not grant write")
    void readIsNotWrite() {
      as(someone(), READ);
      refused("complete_task", t -> t.completeTask(1L));
      refused("delete_task", t -> t.deleteTask(1L));
    }

    @Test
    @DisplayName("write does not grant list administration")
    void writeIsNotAdmin() {
      as(someone(), READ, WRITE);
      refused("create_tasklist", t -> t.createTaskList("Sneaky"));
      refused("share_tasklist", t -> t.shareTaskList(1L, "someone@example.com"));
    }

    @Test
    @DisplayName("admin alone does not grant reading")
    void adminIsNotRead() {
      as(someone(), ADMIN);
      refused("get_board", t -> t.getBoard(null, null, null, null));
    }
  }

  @Nested
  @DisplayName("a fully authorised assistant")
  class FullAccess {

    @Test
    @DisplayName("can drive a task through its whole life")
    void endToEnd() {
      String me = someone();
      as(me, READ, WRITE, ADMIN);

      var list = tools.createTaskList("Household");
      var task =
          tools.createTask("Fix the tile", TaskZone.OPPORTUNITY_NOW, List.of("house"), list.id());

      assertThat(tools.listLabels()).contains("house");

      var promoted = tools.moveTaskZone(task.id(), TaskZone.CRITICAL_NOW);
      assertThat(promoted.zone()).isEqualTo(TaskZone.CRITICAL_NOW);

      var board = tools.getBoard("house", null, null, null);
      assertThat(board.tasks()).extracting(t -> t.title()).contains("Fix the tile");

      tools.completeTask(task.id());
      assertThat(tools.getBoard("house", null, null, null).tasks())
          .extracting(t -> t.title())
          .doesNotContain("Fix the tile");
    }

    @Test
    @DisplayName("sees the zone loads counted across every list, not per list")
    void capsSpanLists() {
      String me = someone();
      as(me, READ, WRITE, ADMIN);
      var personal = tools.createTaskList("Personal " + System.nanoTime());
      var family = tools.createTaskList("Family " + System.nanoTime());
      for (int i = 0; i < 3; i++) {
        tools.createTask("P" + i, TaskZone.CRITICAL_NOW, List.of(), personal.id());
        tools.createTask("F" + i, TaskZone.CRITICAL_NOW, List.of(), family.id());
      }

      var criticalOnBoard =
          tools.getBoard(null, null, null, null).zones().stream()
              .filter(z -> z.zone() == TaskZone.CRITICAL_NOW)
              .findFirst()
              .orElseThrow();
      assertThat(criticalOnBoard.open()).isEqualTo(6);
      assertThat(criticalOnBoard.overSoftCap())
          .as("the cap is what the assistant reads before promoting anything else")
          .isTrue();
    }
  }
}
