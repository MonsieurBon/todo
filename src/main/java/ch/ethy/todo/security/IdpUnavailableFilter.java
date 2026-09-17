package ch.ethy.todo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoderInitializationException;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * The decoder resolves issuer metadata on the first request carrying a token, and an unreachable
 * IdP fails with {@link JwtDecoderInitializationException} — not an {@code
 * AuthenticationException}, so it escapes the chain as a 500. Not 401 either: the token was never
 * examined, and a fresh one would fail the same way.
 */
class IdpUnavailableFilter extends OncePerRequestFilter {

  /** Keycloak restarts in well under a minute; sooner than that is just noise. */
  private static final String RETRY_AFTER_SECONDS = "10";

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    try {
      chain.doFilter(request, response);
    } catch (JwtDecoderInitializationException unavailable) {
      logger.warn("Identity provider unreachable; answering 503", unavailable);
      if (response.isCommitted()) {
        throw unavailable;
      }
      response.reset();
      response.setStatus(HttpStatus.SERVICE_UNAVAILABLE.value());
      response.setHeader(HttpHeaders.RETRY_AFTER, RETRY_AFTER_SECONDS);
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      response
          .getWriter()
          .write(
              """
              {"error":"identity_provider_unavailable",\
              "message":"The identity provider could not be reached. Try again shortly."}""");
    }
  }
}
