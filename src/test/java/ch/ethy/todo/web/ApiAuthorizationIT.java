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
 * The authorization suite.
 *
 * <p>Every test here asserts a <em>denial</em>, because that is the half the previous version of
 * this app got wrong. Its {@code editTask} resolver checked access, skipped the write when the
 * check failed, and then returned the entity anyway — so any user could read any task in the
 * database. The allow paths were all correct and thoroughly exercised; nothing was watching the
 * deny paths.
 *
 * <p>Two distinct boundaries are covered:
 *
 * <ul>
 *   <li><b>Scope</b> — what the AI client is allowed to do at all. Enforced by Spring Security
 *       before the controller runs; a violation is 403 and must carry no body.
 *   <li><b>Ownership</b> — whose data it is. Enforced by resolving every id together with the user
 *       in a scoped query; a violation is 404, deliberately indistinguishable from "no such id" so
 *       that probing cannot confirm which ids exist.
 * </ul>
 */
class ApiAuthorizationIT extends IntegrationTest {

  /** Replaced so the context starts without reaching out to the IdP for issuer metadata. */
  @Autowired private MockMvc mvc;

  @Autowired private ObjectMapper json;

  private static final String ALICE = "subject-alice";
  private static final String BOB = "subject-bob";

  private static final String READ = "SCOPE_todo:read";
  private static final String WRITE = "SCOPE_todo:write";
  private static final String ADMIN = "SCOPE_todo:admin";
  private static final String CAPTURE = "SCOPE_todo:capture";

  /** A caller identified by IdP subject, holding exactly the scopes given. */
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
                    post("/api/tasklists").with(as(ALICE, READ, WRITE, ADMIN)),
                    java.util.Map.of("name", "Alice's list " + System.nanoTime())))
            .andReturn();
    aliceList = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();

    MvcResult task =
        mvc.perform(
                withBody(
                    post("/api/tasklists/" + aliceList + "/tasks").with(as(ALICE, READ, WRITE)),
                    java.util.Map.of("title", "Alice's private task", "zone", "CRITICAL_NOW")))
            .andReturn();
    aliceTask = json.readTree(task.getResponse().getContentAsString()).get("id").asLong();

    // Bob must exist before he can be probed against, and provisioning happens on first request.
    mvc.perform(get("/api/tasklists").with(as(BOB, READ))).andReturn();
  }

  @Nested
  @DisplayName("ownership — another user's data is invisible, not merely read-only")
  class Ownership {

    @Test
    @DisplayName("Bob cannot read Alice's list")
    void cannotReadList() throws Exception {
      MvcResult r = mvc.perform(get("/api/tasklists/" + aliceList).with(as(BOB, READ))).andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(404);
      assertThat(r.getResponse().getContentAsString()).doesNotContain("Alice");
    }

    @Test
    @DisplayName("Bob cannot read Alice's task — the exact bug the old app shipped")
    void cannotReadTask() throws Exception {
      MvcResult r = mvc.perform(get("/api/tasks/" + aliceTask).with(as(BOB, READ))).andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(404);
      assertThat(r.getResponse().getContentAsString()).doesNotContain("Alice's private task");
    }

    @Test
    @DisplayName("Bob cannot list the tasks in Alice's list")
    void cannotListTasks() throws Exception {
      MvcResult r =
          mvc.perform(get("/api/tasklists/" + aliceList + "/tasks").with(as(BOB, READ)))
              .andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(404);
      assertThat(r.getResponse().getContentAsString()).doesNotContain("Alice's private task");
    }

    @Test
    @DisplayName("Bob cannot modify Alice's task, and the refusal returns nothing about it")
    void cannotModifyTask() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              withBody(
                  patch("/api/tasks/" + aliceTask).with(as(BOB, WRITE)),
                  java.util.Map.of("title", "hijacked")),
              post("/api/tasks/" + aliceTask + "/complete").with(as(BOB, WRITE)),
              post("/api/tasks/" + aliceTask + "/reopen").with(as(BOB, WRITE)),
              withBody(
                  post("/api/tasks/" + aliceTask + "/zone").with(as(BOB, WRITE)),
                  java.util.Map.of("zone", "OVER_THE_HORIZON")),
              delete("/api/tasks/" + aliceTask).with(as(BOB, WRITE)))) {
        MvcResult r = mvc.perform(request).andReturn();
        assertThat(r.getResponse().getStatus()).isEqualTo(404);
        assertThat(r.getResponse().getContentAsString()).doesNotContain("Alice's private task");
      }

      // and it really was not modified
      MvcResult still =
          mvc.perform(get("/api/tasks/" + aliceTask).with(as(ALICE, READ))).andReturn();
      assertThat(still.getResponse().getContentAsString()).contains("Alice's private task");
    }

    @Test
    @DisplayName("Bob cannot rename, delete or share Alice's list")
    void cannotAdministerList() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              withBody(
                  patch("/api/tasklists/" + aliceList).with(as(BOB, ADMIN)),
                  java.util.Map.of("name", "hijacked")),
              withBody(
                  post("/api/tasklists/" + aliceList + "/shares").with(as(BOB, ADMIN)),
                  java.util.Map.of("email", BOB + "@example.com")),
              delete("/api/tasklists/" + aliceList).with(as(BOB, ADMIN)))) {
        assertThat(mvc.perform(request).andReturn().getResponse().getStatus()).isEqualTo(404);
      }
    }

    @Test
    @DisplayName("a member of a shared list still may not administer it")
    void memberIsNotOwner() throws Exception {
      mvc.perform(
              withBody(
                  post("/api/tasklists/" + aliceList + "/shares").with(as(ALICE, ADMIN)),
                  java.util.Map.of("email", BOB + "@example.com")))
          .andReturn();

      // Bob can now see it...
      assertThat(
              mvc.perform(get("/api/tasklists/" + aliceList).with(as(BOB, READ)))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(200);

      // ...but renaming and deleting remain the owner's alone.
      assertThat(
              mvc.perform(
                      withBody(
                          patch("/api/tasklists/" + aliceList).with(as(BOB, ADMIN)),
                          java.util.Map.of("name", "Bob's now")))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(404);
      assertThat(
              mvc.perform(delete("/api/tasklists/" + aliceList).with(as(BOB, ADMIN)))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(404);
    }
  }

  @Nested
  @DisplayName("scope — what an AI client may do at all")
  class Scopes {

    @Test
    @DisplayName("a capture-only client cannot read anything, and the refusal carries no body")
    void captureCannotRead() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              get("/api/tasklists").with(as(ALICE, CAPTURE)),
              get("/api/tasklists/" + aliceList).with(as(ALICE, CAPTURE)),
              get("/api/tasks/" + aliceTask).with(as(ALICE, CAPTURE)))) {
        MvcResult r = mvc.perform(request).andReturn();
        assertThat(r.getResponse().getStatus()).isEqualTo(403);
        assertThat(r.getResponse().getContentAsString()).isEmpty();
      }
    }

    @Test
    @DisplayName("a capture-only client cannot edit, complete or delete")
    void captureCannotWrite() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              post("/api/tasks/" + aliceTask + "/complete").with(as(ALICE, CAPTURE)),
              withBody(
                  patch("/api/tasks/" + aliceTask).with(as(ALICE, CAPTURE)),
                  java.util.Map.of("title", "not mine to edit")),
              delete("/api/tasks/" + aliceTask).with(as(ALICE, CAPTURE)))) {
        MvcResult r = mvc.perform(request).andReturn();
        assertThat(r.getResponse().getStatus()).isEqualTo(403);
        assertThat(r.getResponse().getContentAsString()).isEmpty();
      }
    }

    @Test
    @DisplayName("a capture-only client CAN file a task into its inbox")
    void captureCanCapture() throws Exception {
      MvcResult r =
          mvc.perform(
                  withBody(
                      post("/api/tasks/capture").with(as(ALICE, CAPTURE)),
                      java.util.Map.of("title", "Buy milk")))
              .andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(201);
      assertThat(r.getResponse().getContentAsString()).contains("Buy milk");
    }

    @Test
    @DisplayName("a read-only client cannot write")
    void readCannotWrite() throws Exception {
      for (MockHttpServletRequestBuilder request :
          List.of(
              post("/api/tasks/" + aliceTask + "/complete").with(as(ALICE, READ)),
              withBody(
                  patch("/api/tasks/" + aliceTask).with(as(ALICE, READ)),
                  java.util.Map.of("title", "not mine to edit")))) {
        MvcResult r = mvc.perform(request).andReturn();
        assertThat(r.getResponse().getStatus()).isEqualTo(403);
        assertThat(r.getResponse().getContentAsString()).isEmpty();
      }
    }

    @Test
    @DisplayName("managing lists needs admin, which read and write do not imply")
    void listAdminNeedsAdminScope() throws Exception {
      assertThat(
              mvc.perform(
                      withBody(
                          post("/api/tasklists").with(as(ALICE, READ, WRITE)),
                          java.util.Map.of("name", "Sneaky")))
                  .andReturn()
                  .getResponse()
                  .getStatus())
          .isEqualTo(403);
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
                      post("/api/tasks/capture").with(as(ALICE, CAPTURE)),
                      java.util.Map.of("title", "   ")))
              .andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(400);
      assertThat(r.getResponse().getContentAsString()).contains("title");
    }

    @Test
    @DisplayName("deferring into the past is refused rather than silently ignored")
    void backdatedDeferral() throws Exception {
      MvcResult r =
          mvc.perform(
                  withBody(
                      post("/api/tasks/" + aliceTask + "/defer").with(as(ALICE, WRITE)),
                      java.util.Map.of("until", java.time.LocalDate.now().minusDays(1).toString())))
              .andReturn();
      assertThat(r.getResponse().getStatus()).isEqualTo(400);
    }
  }
}
