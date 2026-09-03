package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * What the offline queue needs from the API.
 *
 * <p>A task captured with no signal is replayed when the connection returns, and a replay cannot
 * tell "the request never arrived" from "the response never came back". Without a client-supplied
 * reference the second case silently duplicates the task, which is the failure people actually
 * notice — so creating twice with the same {@code clientRef} must create once.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class OfflineCaptureIT {

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

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;

  private static final AtomicLong SUBJECTS = new AtomicLong();

  private static final String CAPTURE = "SCOPE_todo:capture";
  private static final String READ = "SCOPE_todo:read";
  private static final String WRITE = "SCOPE_todo:write";
  private static final String ADMIN = "SCOPE_todo:admin";

  private static String someone() {
    return "offline-" + SUBJECTS.incrementAndGet() + "-" + System.nanoTime();
  }

  private static RequestPostProcessor as(String subject, String... authorities) {
    List<GrantedAuthority> granted =
        java.util.Arrays.stream(authorities)
            .map(SimpleGrantedAuthority::new)
            .map(GrantedAuthority.class::cast)
            .toList();
    return jwt()
        .jwt(b -> b.subject(subject).claim("email", subject + "@example.com"))
        .authorities(granted);
  }

  private JsonNode perform(MockHttpServletRequestBuilder request) throws Exception {
    String content = mvc.perform(request).andReturn().getResponse().getContentAsString();
    return content.isEmpty() ? json.createObjectNode() : json.readTree(content);
  }

  private JsonNode captured(String who, String title, String clientRef) throws Exception {
    Map<String, Object> payload = new HashMap<>();
    payload.put("title", title);
    payload.put("clientRef", clientRef);
    return perform(
        post("/api/tasks/capture")
            .with(as(who, CAPTURE))
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(payload)));
  }

  private JsonNode addedTo(String who, Long list, String title, String clientRef) throws Exception {
    Map<String, Object> payload = new HashMap<>();
    payload.put("title", title);
    payload.put("zone", "CRITICAL_NOW");
    payload.put("clientRef", clientRef);
    return perform(
        post("/api/tasklists/" + list + "/tasks")
            .with(as(who, WRITE))
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(payload)));
  }

  private List<String> titlesOnBoard(String who) throws Exception {
    List<String> titles = new java.util.ArrayList<>();
    perform(get("/api/board").with(as(who, READ)))
        .get("tasks")
        .forEach(t -> titles.add(t.get("title").asString()));
    return titles;
  }

  @Test
  @DisplayName("replaying a capture with the same reference creates one task, not two")
  void captureIsIdempotent() throws Exception {
    String me = someone();
    String ref = UUID.randomUUID().toString();

    JsonNode first = captured(me, "Call the roofer", ref);
    JsonNode replay = captured(me, "Call the roofer", ref);

    assertThat(replay.get("id").asLong())
        .as("the replay must resolve to the task the first attempt created")
        .isEqualTo(first.get("id").asLong());
    assertThat(titlesOnBoard(me)).containsExactly("Call the roofer");
  }

  @Test
  @DisplayName("the reference comes back, so the queue can reconcile what it sent")
  void referenceIsEchoed() throws Exception {
    String me = someone();
    String ref = UUID.randomUUID().toString();

    assertThat(captured(me, "Buy tiles", ref).get("clientRef").asString()).isEqualTo(ref);
  }

  @Test
  @DisplayName("distinct references are distinct tasks, however alike they look")
  void differentReferencesAreDifferentTasks() throws Exception {
    String me = someone();

    captured(me, "Water the plants", UUID.randomUUID().toString());
    captured(me, "Water the plants", UUID.randomUUID().toString());

    assertThat(titlesOnBoard(me)).containsExactly("Water the plants", "Water the plants");
  }

  @Test
  @DisplayName("a capture with no reference is never deduplicated")
  void noReferenceMeansNoDeduplication() throws Exception {
    String me = someone();

    captured(me, "Same title twice", null);
    captured(me, "Same title twice", null);

    assertThat(titlesOnBoard(me)).hasSize(2);
  }

  @Test
  @DisplayName("replaying against a list resolves to the task that list already holds")
  void listCreateIsIdempotent() throws Exception {
    String me = someone();
    Long list =
        perform(
                post("/api/tasklists")
                    .with(as(me, ADMIN))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("name", "Household"))))
            .get("id")
            .asLong();
    String ref = UUID.randomUUID().toString();

    JsonNode first = addedTo(me, list, "Fix the tile", ref);
    JsonNode replay = addedTo(me, list, "Fix the tile", ref);

    assertThat(replay.get("id").asLong()).isEqualTo(first.get("id").asLong());
    assertThat(titlesOnBoard(me)).containsExactly("Fix the tile");
  }

  @Test
  @DisplayName("one person's reference never resolves to another person's task")
  void referencesDoNotCrossUsers() throws Exception {
    String me = someone();
    String you = someone();
    String ref = UUID.randomUUID().toString();

    JsonNode mine = captured(me, "My private errand", ref);
    JsonNode yours = captured(you, "Your errand", ref);

    assertThat(yours.get("id").asLong())
        .as("a guessed reference must not hand over someone else's task")
        .isNotEqualTo(mine.get("id").asLong());
    assertThat(yours.get("title").asString()).isEqualTo("Your errand");
    assertThat(titlesOnBoard(you)).containsExactly("Your errand");
  }
}
