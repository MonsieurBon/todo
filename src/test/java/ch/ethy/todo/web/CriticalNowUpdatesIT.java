package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.ethy.todo.IntegrationTest;
import ch.ethy.todo.domain.TaskZone;
import ch.ethy.todo.mcp.TodoTools;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * A device's notification follows its user's Critical Now through whatever changed it, once the
 * change has committed. Only the real transactions and the real flush say whether that holds.
 */
class CriticalNowUpdatesIT extends IntegrationTest {

  private static final String P256DH =
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
  private static final String AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
  private static final AtomicLong UNIQUE = new AtomicLong();

  @Autowired private MockMvc mvc;
  @Autowired private ObjectMapper json;
  @Autowired private TodoTools tools;

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  private static String someone() {
    return "updates-" + UNIQUE.incrementAndGet() + "-" + System.nanoTime();
  }

  private static RequestPostProcessor as(String subject) {
    return jwt()
        .jwt(b -> b.subject(subject).claim("email", subject + "@example.com"))
        .authorities(new SimpleGrantedAuthority("SCOPE_todo:api"));
  }

  private JsonNode perform(MockHttpServletRequestBuilder request, Object body) throws Exception {
    String content =
        mvc.perform(
                request
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(body)))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return content.isEmpty() ? json.createObjectNode() : json.readTree(content);
  }

  private long capture(String who, String title, String zone) throws Exception {
    return perform(post("/api/tasks/capture").with(as(who)), Map.of("title", title, "zone", zone))
        .get("id")
        .asLong();
  }

  /** A device of this user's, past its first push. */
  private String aDevice(String who) throws Exception {
    String endpoint =
        "https://fcm.googleapis.com/fcm/send/updates-"
            + UNIQUE.incrementAndGet()
            + "-"
            + System.nanoTime();
    mvc.perform(
            put("/api/push/subscription")
                .with(as(who))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json.writeValueAsString(
                        Map.of("endpoint", endpoint, "p256dh", P256DH, "auth", AUTH))))
        .andExpect(status().isNoContent());
    await().until(() -> pushes.sentTo(endpoint).size() == 1);
    return endpoint;
  }

  private String nextPush(String endpoint, int before) {
    await().until(() -> pushes.sentTo(endpoint).size() > before);
    return pushes.sentTo(endpoint).get(before);
  }

  private void overMcpAs(String subject) {
    Jwt token =
        Jwt.withTokenValue("test")
            .header("alg", "none")
            .subject(subject)
            .claim("email", subject + "@example.com")
            .build();
    var auth = new TestingAuthenticationToken(token, null, List.of());
    auth.setAuthenticated(true);
    SecurityContextHolder.getContext().setAuthentication(auth);
  }

  @Test
  @DisplayName("a task captured into Critical Now reaches the device")
  void aCaptureReachesTheDevice() throws Exception {
    String me = someone();
    String device = aDevice(me);

    capture(me, "Call the plumber", "CRITICAL_NOW");

    assertThat(nextPush(device, 1)).contains("Call the plumber");
  }

  @Test
  @DisplayName("an assistant moving a task over MCP reaches the device too")
  void anMcpChangeReachesTheDevice() throws Exception {
    String me = someone();
    long task = capture(me, "Renew the passport", "OPPORTUNITY_NOW");
    String device = aDevice(me);

    overMcpAs(me);
    tools.moveTasksToZone(List.of(task), TaskZone.CRITICAL_NOW);

    assertThat(nextPush(device, 1)).contains("Renew the passport");
  }

  @Test
  @DisplayName("a change that leaves Critical Now as it was sends nothing")
  void anUnrelatedChangeSendsNothing() throws Exception {
    String me = someone();
    long elsewhere = capture(me, "Some day", "OVER_THE_HORIZON");
    String device = aDevice(me);

    perform(patch("/api/tasks/" + elsewhere).with(as(me)), Map.of("notes", "More thoughts"));
    capture(me, "Pay rent", "CRITICAL_NOW");

    assertThat(nextPush(device, 1)).contains("Pay rent");
    assertThat(pushes.sentTo(device)).hasSize(2);
  }

  @Test
  @DisplayName("a write refused halfway rolls back, and sends nothing")
  void aRolledBackWriteSendsNothing() throws Exception {
    String me = someone();
    long mine = capture(me, "Mine", "OPPORTUNITY_NOW");
    long theirs = capture(someone(), "Not mine", "OPPORTUNITY_NOW");
    String device = aDevice(me);

    mvc.perform(
            post("/api/tasks/zone")
                .with(as(me))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json.writeValueAsString(
                        Map.of("taskIds", List.of(mine, theirs), "zone", "CRITICAL_NOW"))))
        .andExpect(status().isNotFound());
    capture(me, "Afterwards", "CRITICAL_NOW");

    String next = nextPush(device, 1);
    assertThat(next).contains("Afterwards").doesNotContain("Mine");
    assertThat(pushes.sentTo(device)).hasSize(2);
  }

  @Test
  @DisplayName(
      "sharing a list shows its Critical Now on the new member's device, unsharing removes it")
  void sharingChangesWhoSeesIt() throws Exception {
    String owner = someone();
    String member = someone();
    capture(member, "Member's own", "CRITICAL_NOW");
    String device = aDevice(member);
    long list =
        perform(post("/api/tasklists").with(as(owner)), Map.of("name", "House")).get("id").asLong();
    perform(
        post("/api/tasklists/" + list + "/tasks").with(as(owner)),
        Map.of("title", "Fix the roof", "zone", "CRITICAL_NOW"));

    perform(
        post("/api/tasklists/" + list + "/shares").with(as(owner)),
        Map.of("email", member + "@example.com"));

    assertThat(nextPush(device, 1)).contains("Fix the roof").contains("Member's own");

    perform(
        delete("/api/tasklists/" + list + "/shares").with(as(owner)),
        Map.of("email", member + "@example.com"));

    assertThat(nextPush(device, 2)).doesNotContain("Fix the roof").contains("Member's own");
  }

  @Test
  @DisplayName("what someone else does on a shared list reaches every member's device")
  void anotherMembersChangeReachesTheDevice() throws Exception {
    String owner = someone();
    String member = someone();
    capture(member, "Member's own", "CRITICAL_NOW");
    long list =
        perform(post("/api/tasklists").with(as(owner)), Map.of("name", "Flat")).get("id").asLong();
    perform(
        post("/api/tasklists/" + list + "/shares").with(as(owner)),
        Map.of("email", member + "@example.com"));
    String device = aDevice(member);

    long task =
        perform(
                post("/api/tasklists/" + list + "/tasks").with(as(owner)),
                Map.of("title", "Water the plants", "zone", "CRITICAL_NOW"))
            .get("id")
            .asLong();

    assertThat(nextPush(device, 1)).contains("Water the plants");

    mvc.perform(post("/api/tasks/" + task + "/complete").with(as(owner)))
        .andExpect(status().isOk());

    assertThat(nextPush(device, 2)).doesNotContain("Water the plants").contains("Member's own");
  }

  @Test
  @DisplayName("deleting a shared list takes its tasks off every member's device")
  void deletingAListReachesItsMembers() throws Exception {
    String owner = someone();
    String member = someone();
    capture(member, "Member's own", "CRITICAL_NOW");
    long list =
        perform(post("/api/tasklists").with(as(owner)), Map.of("name", "Trip")).get("id").asLong();
    perform(
        post("/api/tasklists/" + list + "/tasks").with(as(owner)),
        Map.of("title", "Book the ferry", "zone", "CRITICAL_NOW"));
    perform(
        post("/api/tasklists/" + list + "/shares").with(as(owner)),
        Map.of("email", member + "@example.com"));
    String device = aDevice(member);
    assertThat(pushes.sentTo(device).getFirst()).contains("Book the ferry");

    mvc.perform(delete("/api/tasklists/" + list).with(as(owner))).andExpect(status().isNoContent());

    assertThat(nextPush(device, 1)).doesNotContain("Book the ferry").contains("Member's own");
  }
}
