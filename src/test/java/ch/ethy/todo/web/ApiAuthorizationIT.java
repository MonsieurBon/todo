package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import ch.ethy.todo.IntegrationTest;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

/**
 * Every test here asserts a <em>denial</em>, across two boundaries:
 *
 * <ul>
 *   <li><b>Surface</b> — a token is minted for the REST API or for the MCP server, never both;
 *       enforced before the controller runs, and a violation is 403 carrying no body.
 *   <li><b>Ownership</b> — enforced by resolving every id together with the user; a violation is
 *       404, indistinguishable from "no such id" so probing cannot confirm which ids exist.
 * </ul>
 */
class ApiAuthorizationIT extends IntegrationTest {

  @Autowired private MockMvc mvc;

  @Autowired private ObjectMapper json;

  private static final String ALICE = "subject-alice";
  private static final String BOB = "subject-bob";

  private static final String API = "SCOPE_todo:api";
  private static final String MCP = "SCOPE_todo:mcp";

  private static org.springframework.test.web.servlet.request.RequestPostProcessor as(
      String subject, String... authorities) {
    List<GrantedAuthority> granted =
        Arrays.stream(authorities)
            .map(SimpleGrantedAuthority::new)
            .map(GrantedAuthority.class::cast)
            .toList();
    return jwt()
        .jwt(builder -> builder.subject(subject).claim("email", subject + "@example.com"))
        .authorities(granted);
  }

  private MockHttpServletRequestBuilder withBody(
      MockHttpServletRequestBuilder builder, Object body) {
    try {
      return builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private Long aliceList;
  private Long aliceTask;

  @BeforeEach
  void seed() throws Exception {
    MvcResult created =
        mvc.perform(
                withBody(
                    post("/api/tasklists").with(as(ALICE, API)),
                    java.util.Map.of("name", "Alice's list " + System.nanoTime())))
            .andReturn();
    aliceList = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();

    MvcResult task =
        mvc.perform(
                withBody(
                    post("/api/tasklists/" + aliceList + "/tasks").with(as(ALICE, API)),
                    java.util.Map.of("title", "Alice's private task", "zone", "CRITICAL_NOW")))
            .andReturn();
    aliceTask = json.readTree(task.getResponse().getContentAsString()).get("id").asLong();

    // Bob must exist before he can be probed against, and provisioning happens on first request.
    mvc.perform(get("/api/tasklists").with(as(BOB, API))).andReturn();
  }

  @Nested
  @DisplayName("ownership — another user's data is invisible, not merely read-only")
  class Ownership {

    @Test
    @DisplayName("Bob cannot read Alice's list")
    void cannotReadList() throws Exception {
      MvcResult r = mvc.perform(get("/api/tasklists/" + aliceList).with(as(BOB, API))).andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(404);
      assertThat(r.getResponse().getContentAsString()).doesNotContain("Alice");
    }

    @Test
    @DisplayName("Bob cannot read Alice's task — the exact bug the old app shipped")
    void cannotReadTask() throws Exception {
      MvcResult r = mvc.perform(get("/api/tasks/" + aliceTask).with(as(BOB, API))).andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(404);
      assertThat(r.getResponse().getContentAsString()).doesNotContain("Alice's private task");
    }

    @Test
    @DisplayName("Bob cannot list the tasks in Alice's list")
    void cannotListTasks() throws Exception {
      MvcResult r =
          mvc.perform(get("/api/tasklists/" + aliceList + "/tasks").with(as(BOB, API))).andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(404);
      assertThat(r.getResponse().getContentAsString()).doesNotContain("Alice's private task");
    }

    @Test
    @DisplayName("Bob cannot modify Alice's task, and the refusal returns nothing about it")
    void cannotModifyTask() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              withBody(
                  patch("/api/tasks/" + aliceTask).with(as(BOB, API)),
                  java.util.Map.of("title", "hijacked")),
              post("/api/tasks/" + aliceTask + "/complete").with(as(BOB, API)),
              post("/api/tasks/" + aliceTask + "/reopen").with(as(BOB, API)),
              withBody(
                  post("/api/tasks/" + aliceTask + "/zone").with(as(BOB, API)),
                  java.util.Map.of("zone", "OVER_THE_HORIZON")),
              delete("/api/tasks/" + aliceTask).with(as(BOB, API)))) {
        MvcResult r = mvc.perform(request).andReturn();
        assertThat(r.getResponse().getStatus()).isEqualTo(404);
        assertThat(r.getResponse().getContentAsString()).doesNotContain("Alice's private task");
      }

      // and it really was not modified
      MvcResult still =
          mvc.perform(get("/api/tasks/" + aliceTask).with(as(ALICE, API))).andReturn();
      assertThat(still.getResponse().getContentAsString()).contains("Alice's private task");
    }

    @Test
    @DisplayName(
        "Bob cannot slip Alice's task in among his own, and the refusal changes none of them")
    void cannotHideAmongOwn() throws Exception {
      MvcResult own =
          mvc.perform(
                  withBody(
                      post("/api/tasks/capture").with(as(BOB, API)),
                      java.util.Map.of("title", "Bob's task", "zone", "OPPORTUNITY_NOW")))
              .andReturn();
      Long bobTask = json.readTree(own.getResponse().getContentAsString()).get("id").asLong();
      String alicesStamp = reviewedAt(ALICE, aliceTask);
      String bobsStamp = reviewedAt(BOB, bobTask);
      List<Long> mixed = List.of(bobTask, aliceTask);
      clock.advance(java.time.Duration.ofHours(1));

      for (MockHttpServletRequestBuilder request :
          List.of(
              withBody(
                  post("/api/tasks/reviewed").with(as(BOB, API)),
                  java.util.Map.of("taskIds", mixed)),
              withBody(
                  post("/api/tasks/zone").with(as(BOB, API)),
                  java.util.Map.of("taskIds", mixed, "zone", "OVER_THE_HORIZON")),
              withBody(
                  post("/api/tasks/defer").with(as(BOB, API)),
                  java.util.Map.of("taskIds", mixed, "until", "2030-01-01")))) {
        MvcResult r = mvc.perform(request).andReturn();
        assertThat(r.getResponse().getStatus()).isEqualTo(404);
        assertThat(r.getResponse().getContentAsString()).doesNotContain("Alice's private task");
      }

      assertThat(reviewedAt(ALICE, aliceTask)).isEqualTo(alicesStamp);
      assertThat(reviewedAt(BOB, bobTask)).isEqualTo(bobsStamp);
    }

    private String reviewedAt(String who, Long task) throws Exception {
      return json.readTree(
              mvc.perform(get("/api/tasks/" + task).with(as(who, API)))
                  .andReturn()
                  .getResponse()
                  .getContentAsString())
          .get("lastReviewedAt")
          .asString();
    }

    @Test
    @DisplayName("Bob cannot rename, delete or share Alice's list")
    void cannotAdministerList() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              withBody(
                  patch("/api/tasklists/" + aliceList).with(as(BOB, API)),
                  java.util.Map.of("name", "hijacked")),
              withBody(
                  post("/api/tasklists/" + aliceList + "/shares").with(as(BOB, API)),
                  java.util.Map.of("email", BOB + "@example.com")),
              delete("/api/tasklists/" + aliceList).with(as(BOB, API)))) {
        assertThat(mvc.perform(request).andReturn().getResponse().getStatus()).isEqualTo(404);
      }
    }

    @Test
    @DisplayName("a member of a shared list still may not administer it")
    void memberIsNotOwner() throws Exception {
      mvc.perform(
              withBody(
                  post("/api/tasklists/" + aliceList + "/shares").with(as(ALICE, API)),
                  java.util.Map.of("email", BOB + "@example.com")))
          .andReturn();

      // Bob can now see it...
      assertThat(
              mvc.perform(get("/api/tasklists/" + aliceList).with(as(BOB, API)))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(200);

      // ...but renaming and deleting remain the owner's alone.
      assertThat(
              mvc.perform(
                      withBody(
                          patch("/api/tasklists/" + aliceList).with(as(BOB, API)),
                          java.util.Map.of("name", "Bob's now")))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(404);
      assertThat(
              mvc.perform(delete("/api/tasklists/" + aliceList).with(as(BOB, API)))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(404);
    }
  }

  @Nested
  @DisplayName("surface — an MCP token does not open the REST API")
  class Surface {

    @Test
    @DisplayName("an MCP token cannot read, and the refusal carries no body")
    void mcpCannotRead() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              get("/api/board").with(as(ALICE, MCP)),
              get("/api/tasklists").with(as(ALICE, MCP)),
              get("/api/tasklists/" + aliceList).with(as(ALICE, MCP)),
              get("/api/tasks/" + aliceTask).with(as(ALICE, MCP)))) {
        MvcResult r = mvc.perform(request).andReturn();
        assertThat(r.getResponse().getStatus()).isEqualTo(403);
        assertThat(r.getResponse().getContentAsString()).isEmpty();
      }
    }

    @Test
    @DisplayName("an MCP token cannot capture, edit, complete or delete")
    void mcpCannotWrite() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              withBody(
                  post("/api/tasks/capture").with(as(ALICE, MCP)),
                  java.util.Map.of("title", "through the wrong door")),
              post("/api/tasks/" + aliceTask + "/complete").with(as(ALICE, MCP)),
              withBody(
                  patch("/api/tasks/" + aliceTask).with(as(ALICE, MCP)),
                  java.util.Map.of("title", "not mine to edit")),
              delete("/api/tasks/" + aliceTask).with(as(ALICE, MCP)))) {
        MvcResult r = mvc.perform(request).andReturn();
        assertThat(r.getResponse().getStatus()).isEqualTo(403);
        assertThat(r.getResponse().getContentAsString()).isEmpty();
      }
    }

    @Test
    @DisplayName("an MCP token cannot manage lists")
    void mcpCannotAdminister() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              withBody(
                  post("/api/tasklists").with(as(ALICE, MCP)), java.util.Map.of("name", "Sneaky")),
              delete("/api/tasklists/" + aliceList).with(as(ALICE, MCP)))) {
        assertThat(mvc.perform(request).andReturn().getResponse().getStatus()).isEqualTo(403);
      }
    }

    @Test
    @DisplayName("an API token may do all of it — the surface is the only tier there is")
    void apiTokenIsUnrestricted() throws Exception {
      MvcResult captured =
          mvc.perform(
                  withBody(
                      post("/api/tasks/capture").with(as(ALICE, API)),
                      java.util.Map.of("title", "Buy milk")))
              .andReturn();
      assertThat(captured.getResponse().getStatus()).isEqualTo(201);

      assertThat(
              mvc.perform(get("/api/board").with(as(ALICE, API)))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(200);
      assertThat(
              mvc.perform(post("/api/tasks/" + aliceTask + "/complete").with(as(ALICE, API)))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(200);
      assertThat(
              mvc.perform(
                      withBody(
                          post("/api/tasklists").with(as(ALICE, API)),
                          java.util.Map.of("name", "Another " + System.nanoTime())))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(201);
    }

    @Test
    @DisplayName("no token at all is 401, not 403")
    void anonymousIsUnauthenticated() throws Exception {
      assertThat(mvc.perform(get("/api/tasklists")).andReturn().getResponse().getStatus())
          .isEqualTo(401);
    }
  }

  @Nested
  @DisplayName("validation")
  class Validation {

    @Test
    @DisplayName("a blank title is a 400 with the offending field named")
    void blankTitle() throws Exception {
      MvcResult r =
          mvc.perform(
                  withBody(
                      post("/api/tasks/capture").with(as(ALICE, API)),
                      java.util.Map.of("title", "   ")))
              .andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(400);
      assertThat(r.getResponse().getContentAsString()).contains("title");
    }

    @Test
    @DisplayName("a change to several tasks has to name at least one")
    void bulkNeedsATask() throws Exception {
      MvcResult r =
          mvc.perform(
                  withBody(
                      post("/api/tasks/reviewed").with(as(ALICE, API)),
                      java.util.Map.of("taskIds", List.of())))
              .andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(400);
      assertThat(r.getResponse().getContentAsString()).contains("taskIds");
    }

    @Test
    @DisplayName("deferring into the past is refused rather than silently ignored")
    void backdatedDeferral() throws Exception {
      MvcResult r =
          mvc.perform(
                  withBody(
                      post("/api/tasks/" + aliceTask + "/defer").with(as(ALICE, API)),
                      java.util.Map.of("until", java.time.LocalDate.now().minusDays(1).toString())))
              .andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(400);
    }
  }
}
