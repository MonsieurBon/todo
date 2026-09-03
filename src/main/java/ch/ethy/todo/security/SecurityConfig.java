package ch.ethy.todo.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * This application is a pure OAuth 2.1 resource server: it validates tokens minted by the external
 * IdP and never issues any itself. Audience validation is configured declaratively via {@code
 * spring.security.oauth2.resourceserver.jwt.audiences} and is the boundary the MCP specification
 * requires — a token minted for a different resource must be rejected.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

  private final String issuerUri;
  private final String canonicalUri;

  public SecurityConfig(
      @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuerUri,
      @Value("${spring.security.oauth2.resourceserver.jwt.audiences}") String canonicalUri) {
    this.issuerUri = issuerUri;
    this.canonicalUri = canonicalUri;
  }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        // No cookies, no sessions: every request carries its own bearer token, so there is
        // no ambient authority for CSRF to exploit.
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth
                    // RFC 9728 protected resource metadata must be reachable unauthenticated;
                    // it is how an MCP client discovers which IdP to talk to.
                    .requestMatchers("/.well-known/**")
                    .permitAll()
                    .requestMatchers("/actuator/health/**")
                    .permitAll()
                    .requestMatchers("/api/**", "/mcp", "/mcp/**")
                    .authenticated()
                    .anyRequest()
                    .permitAll())
        .oauth2ResourceServer(
            oauth2 ->
                oauth2
                    .jwt(jwt -> {})
                    .protectedResourceMetadata(
                        metadata ->
                            metadata.protectedResourceMetadataCustomizer(
                                builder ->
                                    builder
                                        .resource(canonicalUri)
                                        .resourceName("One Minute To-Do List")
                                        // MCP requires at least one authorization server here;
                                        // without it a client cannot discover where to
                                        // authenticate.
                                        .authorizationServer(issuerUri)
                                        // NOTE: a single scopes_supported list cannot serve clients
                                        // with different access levels — a capture-only client that
                                        // requests everything listed here gets invalid_scope from
                                        // the IdP. See docs/arc42 and the plan's two-endpoint
                                        // option.
                                        .scope("todo:read"))))
        .build();
  }
}
