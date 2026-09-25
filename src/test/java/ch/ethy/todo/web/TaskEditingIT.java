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
import java.util.List;
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

  /**
   * The rule the column now carries: a topic is identified by how it is spelled, so two spellings
   * are two topics. Only a real schema answers it - the collation is the thing being asserted.
   */
  @Test
  @DisplayName("two spellings of one word are two topics, kept as they were written")
  void spellingsAreTheirOwnTopics() throws Exception {
    String me = "topics-" + System.nanoTime();
    long id = capture(me, Map.of("title", "Fix the roof", "zone", "CRITICAL_NOW"));

    mvc.perform(
            withBody(
                put("/api/tasks/" + id + "/labels").with(as(me)),
                Map.of("labels", List.of("Garden", "garden", "straße", "strasse", "Küche"))))
        .andExpect(status().isOk());

    assertThat(reread(me, id).get("labels").valueStream().map(JsonNode::asString).toList())
        .containsExactlyInAnyOrder("Garden", "garden", "straße", "strasse", "Küche");
  }

  /**
   * A capture arrives through the outbox, which discards a write the server refuses on its merits
   * and says nothing. Nothing about a topic may refuse one, so the task always survives.
   */
  @Test
  @DisplayName("a capture carrying two spellings keeps the task and both topics")
  void aCaptureIsNeverLostToItsTopics() throws Exception {
    String me = "topics-" + System.nanoTime();
    long id =
        capture(
            me,
            Map.of(
                "title",
                "Mow the lawn",
                "zone",
                "CRITICAL_NOW",
                "labels",
                List.of("straße", "strasse")));

    JsonNode task = reread(me, id);
    assertThat(task.get("title").asString()).isEqualTo("Mow the lawn");
    assertThat(task.get("labels").valueStream().map(JsonNode::asString).toList())
        .containsExactlyInAnyOrder("straße", "strasse");
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

  @Test
  @DisplayName("clearing the due date removes it, where a null one would have left it alone")
  void clearDueDate() throws Exception {
    String me = "subject-clearer-" + System.nanoTime();
    long id =
        capture(
            me,
            Map.of(
                "title", "Fix the tile",
                "dueDate", "2026-10-01",
                "zone", "OPPORTUNITY_NOW"));

    mvc.perform(withBody(patch("/api/tasks/" + id).with(as(me)), Map.of("clearDueDate", true)))
        .andExpect(status().isOk());

    assertThat(reread(me, id).get("dueDate").isNull()).isTrue();
  }

  @Test
  @DisplayName("setting a due date and clearing it in one request is refused, and changes nothing")
  void dueDateSetAndClearedAtOnce() throws Exception {
    String me = "subject-indecisive-" + System.nanoTime();
    long id =
        capture(
            me,
            Map.of(
                "title", "Fix the tile",
                "dueDate", "2026-10-01",
                "zone", "OPPORTUNITY_NOW"));

    mvc.perform(
            withBody(
                patch("/api/tasks/" + id).with(as(me)),
                Map.of("dueDate", "2026-11-01", "clearDueDate", true)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("invalid_request"));

    assertThat(reread(me, id).get("dueDate").asString()).isEqualTo("2026-10-01");
  }

  @Test
  @DisplayName("a change to several tasks lands on every one of them")
  void bulkChangesLand() throws Exception {
    String me = "bulk-" + System.nanoTime();
    long first = capture(me, Map.of("title", "Fix the tile", "zone", "OPPORTUNITY_NOW"));
    long second = capture(me, Map.of("title", "Renew passport", "zone", "OPPORTUNITY_NOW"));
    List<Long> both = List.of(first, second);
    String captured = reread(me, first).get("lastReviewedAt").asString();
    clock.advance(java.time.Duration.ofHours(1));

    mvc.perform(withBody(post("/api/tasks/reviewed").with(as(me)), Map.of("taskIds", both)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
    for (long id : both) {
      assertThat(reread(me, id).get("lastReviewedAt").asString()).isNotEqualTo(captured);
    }

    mvc.perform(
            withBody(
                post("/api/tasks/zone").with(as(me)),
                Map.of("taskIds", both, "zone", "CRITICAL_NOW")))
        .andExpect(status().isOk());
    for (long id : both) {
      assertThat(reread(me, id).get("zone").asString()).isEqualTo("CRITICAL_NOW");
    }

    mvc.perform(
            withBody(
                post("/api/tasks/defer").with(as(me)),
                Map.of("taskIds", both, "until", "2030-01-01")))
        .andExpect(status().isOk());
    for (long id : both) {
      assertThat(reread(me, id).get("deferUntil").asString()).isEqualTo("2030-01-01");
    }
  }

  @Test
  @DisplayName("one completed task among several refuses the lot, and none of them changes")
  void bulkIsAllOrNothing() throws Exception {
    String me = "bulk-" + System.nanoTime();
    long open = capture(me, Map.of("title", "Fix the tile", "zone", "OPPORTUNITY_NOW"));
    long done = capture(me, Map.of("title", "Renew passport", "zone", "OPPORTUNITY_NOW"));
    mvc.perform(post("/api/tasks/" + done + "/complete").with(as(me))).andExpect(status().isOk());
    String captured = reread(me, open).get("lastReviewedAt").asString();
    clock.advance(java.time.Duration.ofHours(1));

    mvc.perform(
            withBody(
                post("/api/tasks/zone").with(as(me)),
                Map.of("taskIds", List.of(open, done), "zone", "CRITICAL_NOW")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error").value("task_completed"));

    var untouched = reread(me, open);
    assertThat(untouched.get("zone").asString()).isEqualTo("OPPORTUNITY_NOW");
    assertThat(untouched.get("lastReviewedAt").asString())
        .as("the open task was moved before the completed one refused, and must be rolled back")
        .isEqualTo(captured);
  }
}
