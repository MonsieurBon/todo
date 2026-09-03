package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.List;
import java.util.Map;
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
 * The board: every task the user can see, in three zones, with the caps counted across the whole
 * view rather than per list.
 *
 * <p>The first test here is the reason this phase exists. Counting the caps per list would let five
 * topic-shaped lists hold twenty-five Critical Now tasks with every list reporting itself healthy,
 * which removes the only thing the cap is for.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class BoardIT {

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

  private static final String READ = "SCOPE_todo:read";
  private static final String WRITE = "SCOPE_todo:write";
  private static final String ADMIN = "SCOPE_todo:admin";

  /** Each test gets a fresh person, so counts are not polluted by its neighbours. */
  private static String someone() {
    return "subject-" + SUBJECTS.incrementAndGet() + "-" + System.nanoTime();
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

  private MockHttpServletRequestBuilder body(MockHttpServletRequestBuilder b, Object payload) {
    return b.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(payload));
  }

  private JsonNode perform(MockHttpServletRequestBuilder request) throws Exception {
    String content = mvc.perform(request).andReturn().getResponse().getContentAsString();
    return content.isEmpty() ? json.createObjectNode() : json.readTree(content);
  }

  private Long createList(String who, String name) throws Exception {
    return perform(body(post("/api/tasklists").with(as(who, ADMIN)), Map.of("name", name)))
        .get("id")
        .asLong();
  }

  private void addTask(String who, Long list, String title, String zone, List<String> labels)
      throws Exception {
    perform(
        body(
            post("/api/tasklists/" + list + "/tasks").with(as(who, WRITE)),
            Map.of("title", title, "zone", zone, "labels", labels)));
  }

  private long zoneCount(JsonNode view, String zone) {
    for (JsonNode load : view.get("zones")) {
      if (load.get("zone").asString().equals(zone)) {
        return load.get("open").asLong();
      }
    }
    throw new AssertionError("No zone " + zone + " in " + view);
  }

  private boolean overCap(JsonNode view, String zone) {
    for (JsonNode load : view.get("zones")) {
      if (load.get("zone").asString().equals(zone)) {
        return load.get("overSoftCap").asBoolean();
      }
    }
    throw new AssertionError("No zone " + zone + " in " + view);
  }

  @Test
  @DisplayName("the Critical Now cap counts across every list, not once per list")
  void capIsCountedAcrossLists() throws Exception {
    String me = someone();
    Long personal = createList(me, "Personal");
    Long family = createList(me, "Family");

    for (int i = 0; i < 3; i++) {
      addTask(me, personal, "Personal urgent " + i, "CRITICAL_NOW", List.of());
      addTask(me, family, "Family urgent " + i, "CRITICAL_NOW", List.of());
    }

    // Each list on its own looks perfectly healthy.
    JsonNode personalOnly = perform(get("/api/board?list=" + personal).with(as(me, READ)));
    JsonNode familyOnly = perform(get("/api/board?list=" + family).with(as(me, READ)));
    assertThat(zoneCount(personalOnly, "CRITICAL_NOW")).isEqualTo(3);
    assertThat(overCap(personalOnly, "CRITICAL_NOW")).isFalse();
    assertThat(zoneCount(familyOnly, "CRITICAL_NOW")).isEqualTo(3);
    assertThat(overCap(familyOnly, "CRITICAL_NOW")).isFalse();

    // Together they are what you have actually committed to today: six, over the cap of five.
    JsonNode board = perform(get("/api/board").with(as(me, READ)));
    assertThat(zoneCount(board, "CRITICAL_NOW")).isEqualTo(6);
    assertThat(overCap(board, "CRITICAL_NOW")).isTrue();
    assertThat(board.get("tasks")).hasSize(6);
  }

  @Test
  @DisplayName("a task carries several topics and shows up under each")
  void multipleLabels() throws Exception {
    String me = someone();
    Long list = createList(me, "Work");
    addTask(me, list, "Draft the roof motion", "OPPORTUNITY_NOW", List.of("house", "politics"));
    addTask(me, list, "Buy cement", "OPPORTUNITY_NOW", List.of("house"));

    assertThat(perform(get("/api/board?label=house").with(as(me, READ))).get("tasks")).hasSize(2);
    assertThat(perform(get("/api/board?label=politics").with(as(me, READ))).get("tasks"))
        .hasSize(1);
    assertThat(perform(get("/api/board?label=sports-club").with(as(me, READ))).get("tasks"))
        .isEmpty();

    JsonNode board = perform(get("/api/board?label=politics").with(as(me, READ)));
    JsonNode task = board.get("tasks").get(0);
    assertThat(task.get("labels").size()).isEqualTo(2);
    assertThat(task.get("listName").asString()).isEqualTo("Work");
  }

  @Test
  @DisplayName("a label filter matches however the topic is spelled")
  void filterIsNormalised() throws Exception {
    String me = someone();
    Long list = createList(me, "Projects");
    addTask(me, list, "Kickoff", "CRITICAL_NOW", List.of("Project A"));

    // .param rather than a query string in the URL: MockMvc re-encodes a URI template, so an
    // embedded %20 arrives as a literal "%20" and slugifies into the label name.
    for (String spelling : List.of("Project A", "project a", "project-a", "PROJECT   A")) {
      assertThat(
              perform(get("/api/board").param("label", spelling).with(as(me, READ))).get("tasks"))
          .as("filtering by %s", spelling)
          .hasSize(1);
    }
  }

  @Test
  @DisplayName("labels and lists narrow independently")
  void listAndLabelAreOrthogonal() throws Exception {
    String me = someone();
    Long personal = createList(me, "Personal");
    Long family = createList(me, "Family");
    addTask(me, personal, "Fix the tile", "CRITICAL_NOW", List.of("house"));
    addTask(me, family, "Order the skip", "CRITICAL_NOW", List.of("house"));
    addTask(me, personal, "Write the motion", "CRITICAL_NOW", List.of("politics"));

    assertThat(perform(get("/api/board?label=house").with(as(me, READ))).get("tasks")).hasSize(2);
    assertThat(perform(get("/api/board?list=" + personal).with(as(me, READ))).get("tasks"))
        .hasSize(2);
    assertThat(
            perform(get("/api/board?list=" + personal + "&label=house").with(as(me, READ)))
                .get("tasks"))
        .hasSize(1);
  }

  @Test
  @DisplayName("the zone filter narrows the tasks but leaves all three loads visible")
  void zoneFilterKeepsAllLoads() throws Exception {
    String me = someone();
    Long list = createList(me, "Everything");
    addTask(me, list, "Now", "CRITICAL_NOW", List.of());
    addTask(me, list, "Soon", "OPPORTUNITY_NOW", List.of());
    addTask(me, list, "Someday", "OVER_THE_HORIZON", List.of());

    JsonNode board = perform(get("/api/board?zone=CRITICAL_NOW").with(as(me, READ)));
    assertThat(board.get("tasks")).hasSize(1);
    assertThat(board.get("zones")).hasSize(3);
    assertThat(zoneCount(board, "OPPORTUNITY_NOW")).isEqualTo(1);
    assertThat(zoneCount(board, "OVER_THE_HORIZON")).isEqualTo(1);
  }

  @Test
  @DisplayName("the label index lists only topics the user can actually see")
  void labelIndexIsScoped() throws Exception {
    String me = someone();
    String other = someone();
    addTask(me, createList(me, "Mine"), "Mine", "CRITICAL_NOW", List.of("house", "politics"));
    addTask(other, createList(other, "Theirs"), "Theirs", "CRITICAL_NOW", List.of("secret-topic"));

    JsonNode mine = perform(get("/api/labels").with(as(me, READ)));
    assertThat(mine.toString()).contains("house", "politics").doesNotContain("secret-topic");
  }

  @Test
  @DisplayName("no label filter, however spelled, surfaces another user's task")
  void labelFilterCannotCrossUsers() throws Exception {
    String alice = someone();
    String bob = someone();
    Long hers = createList(alice, "Alice's");
    addTask(alice, hers, "Alice's private task", "CRITICAL_NOW", List.of("house", "secret-topic"));

    // Bob has a task with the SAME label, so the filter matches something he may see —
    // the query still must not reach across to hers.
    addTask(bob, createList(bob, "Bob's"), "Bob's own task", "CRITICAL_NOW", List.of("house"));

    for (String probe :
        List.of("/api/board?label=house", "/api/board?label=secret-topic", "/api/board")) {
      String rendered = perform(get(probe).with(as(bob, READ))).toString();
      assertThat(rendered)
          .as("probing %s as Bob", probe)
          .doesNotContain("Alice's private task")
          .doesNotContain("Alice's");
    }

    // And narrowing to her list id by hand returns nothing rather than her tasks.
    JsonNode byHerListId = perform(get("/api/board?list=" + hers).with(as(bob, READ)));
    assertThat(byHerListId.get("tasks")).isEmpty();
    assertThat(zoneCount(byHerListId, "CRITICAL_NOW")).isZero();
  }

  @Test
  @DisplayName("a shared list counts towards the owner's and the member's caps alike")
  void sharedListCountsForBoth() throws Exception {
    String alice = someone();
    String bob = someone();
    // Bob has to exist before he can be shared with.
    perform(get("/api/board").with(as(bob, READ)));

    Long shared = createList(alice, "Household");
    perform(
        body(
            post("/api/tasklists/" + shared + "/shares").with(as(alice, ADMIN)),
            Map.of("email", bob + "@example.com")));
    addTask(alice, shared, "Fix the tile", "CRITICAL_NOW", List.of("house"));

    assertThat(zoneCount(perform(get("/api/board").with(as(alice, READ))), "CRITICAL_NOW"))
        .isEqualTo(1);
    assertThat(zoneCount(perform(get("/api/board").with(as(bob, READ))), "CRITICAL_NOW"))
        .as("a task on a shared list is a real commitment for the member too")
        .isEqualTo(1);
  }

  @Test
  @DisplayName("deferred tasks stay off the board and out of the counts")
  void deferredIsHidden() throws Exception {
    String me = someone();
    Long list = createList(me, "Someday");
    addTask(me, list, "Visible", "CRITICAL_NOW", List.of());
    JsonNode created =
        perform(
            body(
                post("/api/tasklists/" + list + "/tasks").with(as(me, WRITE)),
                Map.of("title", "Deferred", "zone", "CRITICAL_NOW", "labels", List.of())));
    perform(
        body(
            post("/api/tasks/" + created.get("id").asLong() + "/defer").with(as(me, WRITE)),
            Map.of("until", java.time.LocalDate.now().plusMonths(1).toString())));

    JsonNode board = perform(get("/api/board").with(as(me, READ)));
    assertThat(board.get("tasks")).hasSize(1);
    assertThat(zoneCount(board, "CRITICAL_NOW")).isEqualTo(1);
    assertThat(zoneCount(board, "OVER_THE_HORIZON")).isZero();
  }

  private List<String> titles(JsonNode tasks) {
    List<String> titles = new java.util.ArrayList<>();
    tasks.forEach(t -> titles.add(t.get("title").asString()));
    return titles;
  }

  @Test
  @DisplayName("the review sweep spans every list, and never offers Critical Now")
  void reviewSpansLists() throws Exception {
    String me = someone();
    Long personal = createList(me, "Personal");
    Long family = createList(me, "Family");
    addTask(me, personal, "Soon, personal", "OPPORTUNITY_NOW", List.of());
    addTask(me, family, "Someday, family", "OVER_THE_HORIZON", List.of());
    addTask(me, personal, "Today", "CRITICAL_NOW", List.of());

    assertThat(titles(perform(get("/api/review").with(as(me, READ)))))
        .as("Critical Now is worked continuously, so it is never swept")
        .containsExactlyInAnyOrder("Soon, personal", "Someday, family");
  }

  @Test
  @DisplayName("the sweep takes the board's filters, so you can review one topic")
  void reviewTakesTheBoardsFilters() throws Exception {
    String me = someone();
    Long list = createList(me, "Everything");
    addTask(me, list, "Roof", "OPPORTUNITY_NOW", List.of("house"));
    addTask(me, list, "Taxes", "OPPORTUNITY_NOW", List.of("admin"));

    assertThat(titles(perform(get("/api/review").param("label", "house").with(as(me, READ)))))
        .containsExactly("Roof");
  }

  @Test
  @DisplayName("the sweep never offers another person's task")
  void reviewIsScopedToTheViewer() throws Exception {
    String alice = someone();
    String bob = someone();
    Long hers = createList(alice, "Alice's");
    addTask(alice, hers, "Alice's private task", "OPPORTUNITY_NOW", List.of("house"));

    assertThat(perform(get("/api/review").with(as(bob, READ)))).isEmpty();
    assertThat(perform(get("/api/review?list=" + hers).with(as(bob, READ)))).isEmpty();
    assertThat(perform(get("/api/review").param("label", "house").with(as(bob, READ)))).isEmpty();
  }
}
