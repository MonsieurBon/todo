package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.ethy.todo.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * That an edit is still there afterwards. It once was not: the controller mutated an entity {@code
 * TaskService.accessible} had already detached, so every edit was echoed back and dropped.
 */
class TaskEditingIT extends IntegrationTest {

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;

  private static final String API = "SCOPE_todo:api";

  private static RequestPostProcessor as(String subject) {
    return jwt()
        .jwt(builder -> builder.subject(subject).claim("email", subject + "@example.com"))
        .authorities(new SimpleGrantedAuthority(API));
  }

  private MockHttpServletRequestBuilder withBody(
      MockHttpServletRequestBuilder builder, Object body) {
    return builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
  }

  private long capture(String subject, Map<String, Object> body) throws Exception {
    var response =
        mvc.perform(withBody(post("/api/tasks/capture").with(as(subject)), body))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(response).get("id").asLong();
  }

  /** Through the API, so nothing is asserted against an entity still in hand. */
  private JsonNode reread(String subject, long id) throws Exception {
    return json.readTree(
        mvc.perform(get("/api/tasks/" + id).with(as(subject)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  @Test
  @DisplayName("an edited title, notes and due date are readable afterwards")
  void editsPersist() throws Exception {
    String me = "subject-editor-" + System.nanoTime();
    long id = capture(me, Map.of("title", "Fix the tile", "zone", "OPPORTUNITY_NOW"));

    mvc.perform(
            withBody(
                patch("/api/tasks/" + id).with(as(me)),
                Map.of(
                    "title", "Fix the ridge tile",
                    "notes", "The cracked one above the porch.",
                    "dueDate", "2026-10-01")))
        .andExpect(status().isOk());

    var task = reread(me, id);
    assertThat(task.get("title").asString()).isEqualTo("Fix the ridge tile");
    assertThat(task.get("notes").asString()).isEqualTo("The cracked one above the porch.");
    assertThat(task.get("dueDate").asString()).isEqualTo("2026-10-01");
  }

  @Test
  @DisplayName("a completed task refuses every change until it is reopened")
  void completedIsReadOnly() throws Exception {
    String me = "subject-done-" + System.nanoTime();
    long id =
        capture(
            me,
            Map.of(
                "title", "Fix the tile",
                "labels", java.util.List.of("house"),
                "zone", "OPPORTUNITY_NOW"));
    mvc.perform(post("/api/tasks/" + id + "/complete").with(as(me))).andExpect(status().isOk());

    mvc.perform(withBody(patch("/api/tasks/" + id).with(as(me)), Map.of("title", "Fix the ridge")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error").value("task_completed"));
    mvc.perform(
            withBody(
                post("/api/tasks/" + id + "/zone").with(as(me)), Map.of("zone", "CRITICAL_NOW")))
        .andExpect(status().isConflict());
    mvc.perform(post("/api/tasks/" + id + "/reviewed").with(as(me)))
        .andExpect(status().isConflict());
    mvc.perform(
            withBody(
                post("/api/tasks/" + id + "/defer").with(as(me)), Map.of("until", "2030-01-01")))
        .andExpect(status().isConflict());
    mvc.perform(
            withBody(
                put("/api/tasks/" + id + "/labels").with(as(me)),
                Map.of("labels", java.util.List.of("garden"))))
        .andExpect(status().isConflict());

    var refused = reread(me, id);
    assertThat(refused.get("title").asString()).isEqualTo("Fix the tile");
    assertThat(refused.get("zone").asString()).isEqualTo("OPPORTUNITY_NOW");
    assertThat(refused.get("deferUntil").isNull())
        .as("a deferral slipped onto a done task would still hide it after reopening")
        .isTrue();
    assertThat(refused.get("labels").valueStream().map(JsonNode::asString))
        .containsExactly("house");
  }

  @Test
  @DisplayName("reopening a task makes it editable again")
  void reopeningRestoresEditing() throws Exception {
    String me = "subject-reopen-" + System.nanoTime();
    long id = capture(me, Map.of("title", "Fix the tile", "zone", "OPPORTUNITY_NOW"));
    mvc.perform(post("/api/tasks/" + id + "/complete").with(as(me))).andExpect(status().isOk());
    mvc.perform(post("/api/tasks/" + id + "/reopen").with(as(me))).andExpect(status().isOk());

    mvc.perform(withBody(patch("/api/tasks/" + id).with(as(me)), Map.of("title", "Fix the ridge")))
        .andExpect(status().isOk());

    assertThat(reread(me, id).get("title").asString()).isEqualTo("Fix the ridge");
  }

  @Test
  @DisplayName("an edit leaves alone what it does not mention")
  void omittedFieldsSurvive() throws Exception {
    String me = "subject-partial-" + System.nanoTime();
    long id =
        capture(
            me,
            Map.of(
                "title", "Fix the tile",
                "notes", "The cracked one above the porch.",
                "dueDate", "2026-10-01",
                "zone", "OPPORTUNITY_NOW"));

    mvc.perform(
            withBody(patch("/api/tasks/" + id).with(as(me)), Map.of("title", "Fix the ridge tile")))
        .andExpect(status().isOk());

    var task = reread(me, id);
    assertThat(task.get("title").asString()).isEqualTo("Fix the ridge tile");
    assertThat(task.get("notes").asString())
        .as("a null field means leave it alone, which is what the partial update promises")
        .isEqualTo("The cracked one above the porch.");
    assertThat(task.get("dueDate").asString()).isEqualTo("2026-10-01");
  }
}
