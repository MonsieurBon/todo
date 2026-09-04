package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import ch.ethy.todo.IntegrationTest;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The server has to hand a client-routed URL to the client.
 *
 * <p>Installed to a home screen there is no address bar, so a 404 on {@code /capture} — which is
 * exactly where Android sends a share — is a dead end with no way back. This is the check that the
 * app is reachable at all of its own addresses.
 */
class WebAppHostingIT extends IntegrationTest {

  @Autowired private MockMvc mvc;

  @BeforeAll
  static void requireTheWebAppToHaveBeenBuilt() {
    // `mvn verify` builds the frontend first; an IDE running this alone may not have.
    Assumptions.assumeTrue(
        new ClassPathResource("static/index.html").exists(),
        "the web app is not built - run `npm run build`");
  }

  @Test
  @DisplayName("a route the client owns is answered with the app")
  void clientRoutesReachTheApp() throws Exception {
    for (String route : new String[] {"/capture", "/review", "/lists", "/somewhere/deep"}) {
      String body = mvc.perform(get(route)).andReturn().getResponse().getContentAsString();
      assertThat(body).as("GET %s", route).contains("<app-root>");
    }
  }

  @Test
  @DisplayName("the manifest and the service worker are served from the root")
  void pwaFilesAreWhereTheBrowserLooks() throws Exception {
    // Both are resolved relative to the origin, and the service worker's scope is the directory
    // it is served from: under a subdirectory it would control nothing.
    assertThat(mvc.perform(get("/manifest.webmanifest")).andReturn().getResponse().getStatus())
        .isEqualTo(200);
    assertThat(mvc.perform(get("/ngsw-worker.js")).andReturn().getResponse().getStatus())
        .isEqualTo(200);
  }

  @Test
  @DisplayName("a wrong server path is still a 404, not a page")
  void serverPathsDoNotFallThrough() throws Exception {
    // Answering these with HTML would turn every typo into a JSON parse error at the caller.
    // The bare roots matter as much as the paths beneath them: those are what a person types.
    for (String path :
        new String[] {"/api", "/api/nonexistent", "/actuator", "/actuator/nope", "/v3", "/mcp"}) {
      var response = mvc.perform(get(path)).andReturn().getResponse();
      assertThat(response.getContentAsString())
          .as("GET %s must not be answered with the web app", path)
          .doesNotContain("<app-root>");
    }
  }
}
