package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.ethy.todo.IntegrationTest;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * That an edit is still there afterwards.
 *
 * <p>{@link ApiAuthorizationIT} covers who may PATCH a task; nothing covered whether the PATCH
 * survives the request. It did not: the controller mutated an entity that {@code
 * TaskService.accessible} had already detached, so every edit was accepted, echoed back, and
 * dropped.
 */
class TaskEditingIT extends IntegrationTest {

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;

  private static final String READ = "SCOPE_todo:read";
  private static final String WRITE = "SCOPE_todo:write";

  private static RequestPostProcessor as(String subject, String... authorities) {
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
    return builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
  }

  /** Files a task and returns its id, failing here rather than downstream if capture breaks. */
  private long capture(String subject, Map<String, Object> body) throws Exception {
    var response =
        mvc.perform(withBody(post("/api/tasks/capture").with(as(subject, WRITE)), body))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(response).get("id").asLong();
  }

  /** Reads a task back through the API, so nothing is asserted against an entity still in hand. */
  private JsonNode reread(String subject, long id) throws Exception {
    return json.readTree(
        mvc.perform(get("/api/tasks/" + id).with(as(subject, READ)))
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
                patch("/api/tasks/" + id).with(as(me, WRITE)),
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
            withBody(
                patch("/api/tasks/" + id).with(as(me, WRITE)),
                Map.of("title", "Fix the ridge tile")))
        .andExpect(status().isOk());

    var task = reread(me, id);
    assertThat(task.get("title").asString()).isEqualTo("Fix the ridge tile");
    assertThat(task.get("notes").asString())
        .as("a null field means leave it alone, which is what the partial update promises")
        .isEqualTo("The cracked one above the porch.");
    assertThat(task.get("dueDate").asString()).isEqualTo("2026-10-01");
  }
}
