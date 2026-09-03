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
 * Answers 503 when the identity provider cannot be reached, rather than 500.
 *
 * <p>The token decoder resolves the issuer's metadata lazily, on the first request that carries a
 * token. If the IdP is down at that moment the failure is a {@link
 * JwtDecoderInitializationException}, which is not an {@code AuthenticationException} — so it
 * escapes the security filter chain and surfaces as an Internal Server Error.
 *
 * <p>That status is a lie with operational consequences: it says this application is broken, when
 * this application is fine and a dependency is not. Monitoring pages the wrong person, and the
 * caller is told nothing about whether retrying could help. 503 with {@code Retry-After} says both
 * true things, and it matches the behaviour — the app recovers by itself once the IdP answers, with
 * no restart.
 *
 * <p>Deliberately not 401: the token was never examined, so claiming it is invalid would send a
 * client off to obtain a new one that would fail in exactly the same way.
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
