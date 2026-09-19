package ch.ethy.todo.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import ch.ethy.todo.IntegrationTest;
import ch.ethy.todo.domain.TaskZone;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The tools themselves carry no authorization: a token is minted for the MCP surface or for the
 * REST API, and everything past that gate resolves against the calling user. scripts/verify-mcp.sh
 * covers the same ground against a real Keycloak but does not run in CI.
 */
class McpToolAuthorizationIT extends IntegrationTest {

  @Autowired private TodoTools tools;

  @Autowired private MockMvc mvc;

  @Autowired private ObjectMapper json;

  @Value("${spring.security.oauth2.resourceserver.jwt.audiences}")
  private String canonicalUri;

  private static final String API = "SCOPE_todo:api";
  private static final String MCP = "SCOPE_todo:mcp";

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  private static String someone() {
    return "mcp-subject-" + System.nanoTime();
  }

  private static void as(String subject) {
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

  private static RequestPostProcessor bearing(String authority) {
    String subject = someone();
    return jwt()
        .jwt(builder -> builder.subject(subject).claim("email", subject + "@example.com"))
        .authorities(new SimpleGrantedAuthority(authority));
  }

  @Nested
  @DisplayName("surface — a REST token does not open the MCP server")
  class Surface {

    /** Any JSON-RPC body will do: the gate runs before the transport sees the request. */
    private static final String CALL =
        """
        {"jsonrpc":"2.0","id":1,"method":"tools/list"}""";

    @Test
    @DisplayName("an API token is refused, and the refusal carries no body")
    void apiTokenIsRefused() throws Exception {
      var r =
          mvc.perform(
                  post("/mcp")
                      .with(bearing(API))
                      .contentType(MediaType.APPLICATION_JSON)
                      .accept("application/json", "text/event-stream")
                      .content(CALL))
              .andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(403);
      assertThat(r.getResponse().getContentAsString()).isEmpty();
    }

    @Test
    @DisplayName("no token at all is 401, not 403")
    void anonymousIsUnauthenticated() throws Exception {
      assertThat(
              mvc.perform(
                      post("/mcp")
                          .contentType(MediaType.APPLICATION_JSON)
                          .accept("application/json", "text/event-stream")
                          .content(CALL))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(401);
    }

    @Test
    @DisplayName("an MCP token reaches the transport")
    void mcpTokenPassesTheGate() throws Exception {
      assertThat(
              mvc.perform(
                      post("/mcp")
                          .with(bearing(MCP))
                          .contentType(MediaType.APPLICATION_JSON)
                          .accept("application/json", "text/event-stream")
                          .content(CALL))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isNotIn(401, 403);
    }

    /**
     * How an assistant finds the IdP and learns what to ask for, so it is anonymous and every field
     * is load-bearing. A scope advertised here must be one the MCP client can actually obtain: name
     * todo:api too and a client requesting both is refused by the IdP, not by anything here.
     */
    @Test
    @DisplayName("discovery advertises the MCP surface, anonymously, and nothing else")
    void discoveryServesMcpClients() throws Exception {
      var response =
          mvc.perform(get("/.well-known/oauth-protected-resource")).andReturn().getResponse();
      assertThat(response.getStatus()).isEqualTo(200);

      var document = json.readTree(response.getContentAsString());
      assertThat(document.get("scopes_supported").valueStream().map(JsonNode::asString))
          .containsExactly("todo:mcp");
      assertThat(document.get("authorization_servers")).isNotEmpty();
      assertThat(document.get("resource").asString()).isEqualTo(canonicalUri);
    }

    @Test
    @DisplayName(
        "the refusal points at discovery on the canonical URI, whatever the request claims")
    void refusalPointsAtCanonicalDiscovery() throws Exception {
      var response =
          mvc.perform(
                  post("https://todo.example.com/mcp")
                      .contentType(MediaType.APPLICATION_JSON)
                      .accept("application/json", "text/event-stream")
                      .content(CALL))
              .andReturn()
              .getResponse();
      assertThat(response.getHeader("WWW-Authenticate"))
          .contains(
              "resource_metadata=\"" + canonicalUri + "/.well-known/oauth-protected-resource\"");
    }
  }

  @Nested
  @DisplayName("an assistant on the MCP surface")
  class FullAccess {

    @Test
    @DisplayName("can drive a task through its whole life")
    void endToEnd() {
      as(someone());

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
      as(someone());
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
