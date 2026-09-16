package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.ethy.todo.IntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoderInitializationException;
import org.springframework.test.web.servlet.MockMvc;

/**
 * What an operator and a container runtime see: a health probe, and who is broken when it fails.
 */
class OperabilityIT extends IntegrationTest {

  @Autowired private MockMvc mvc;

  @Test
  @DisplayName("health is public, because a container healthcheck carries no credentials")
  void healthNeedsNoToken() throws Exception {
    mvc.perform(get("/actuator/health")).andExpect(status().isOk());
  }

  @Test
  @DisplayName("health gives an anonymous caller nothing to work with")
  void healthLeaksNothing() throws Exception {
    String body =
        mvc.perform(get("/actuator/health")).andReturn().getResponse().getContentAsString();

    // show-details: never — otherwise this names the database, the disk and what is failing.
    assertThat(body).contains("\"status\":\"UP\"");
    assertThat(body).doesNotContain("database").doesNotContain("MySQL").doesNotContain("diskSpace");
  }

  @Test
  @DisplayName("nothing but health is exposed")
  void onlyHealthIsExposed() throws Exception {
    // env and configprops would publish the datasource password's key, the issuer, everything.
    for (String endpoint : new String[] {"/actuator/env", "/actuator/configprops", "/actuator"}) {
      assertThat(mvc.perform(get(endpoint)).andReturn().getResponse().getStatus())
          .as("GET %s", endpoint)
          .isNotEqualTo(200);
    }
  }

  @Test
  @DisplayName("an unreachable identity provider is 503, not 500")
  void idpDownIsServiceUnavailable() throws Exception {
    // What an unreachable IdP looks like on the first request carrying a token.
    given(jwtDecoder.decode(anyString()))
        .willThrow(
            new JwtDecoderInitializationException(
                "issuer metadata unavailable", new IllegalStateException("connection refused")));

    mvc.perform(get("/api/board").header("Authorization", "Bearer irrelevant"))
        .andExpect(status().isServiceUnavailable())
        // Says retrying is worth it, which is true: the app recovers on its own, no restart.
        .andExpect(header().string("Retry-After", "10"));
  }

  @Test
  @DisplayName("the 503 says a dependency is down, and leaks nothing about it")
  void idpDownExplainsItself() throws Exception {
    given(jwtDecoder.decode(anyString()))
        .willThrow(
            new JwtDecoderInitializationException("boom", new IllegalStateException("host:9999")));

    String body =
        mvc.perform(get("/api/board").header("Authorization", "Bearer irrelevant"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(body).contains("identity_provider_unavailable");
    // The internal address of the IdP is not an anonymous caller's business.
    assertThat(body).doesNotContain("9999");
  }

  @Test
  @DisplayName("a token that is merely invalid is still 401")
  void aBadTokenIsStillUnauthorized() throws Exception {
    // The 503 must not swallow the ordinary case: this token was examined and rejected.
    given(jwtDecoder.decode(anyString())).willThrow(new BadJwtException("signature mismatch"));

    mvc.perform(get("/api/board").header("Authorization", "Bearer nonsense"))
        .andExpect(status().isUnauthorized());
  }
}
