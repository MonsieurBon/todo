package ch.ethy.todo.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * A resource server only. Audience validation — the boundary MCP requires — is configured through
 * {@code spring.security.oauth2.resourceserver.jwt.audiences} rather than here.
 */
@Configuration
@EnableWebSecurity
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
    var entryPoint = new BearerTokenAuthenticationEntryPoint();
    // Behind the proxy the request only knows the app's own address.
    entryPoint.setResourceMetadataParameterResolver(
        request -> canonicalUri + "/.well-known/oauth-protected-resource");

    return http.addFilterBefore(new IdpUnavailableFilter(), BearerTokenAuthenticationFilter.class)
        // Safe to disable: bearer tokens only, so there is no ambient authority to exploit.
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth
                    // RFC 9728 discovery: how an MCP client finds the IdP, so it cannot need a
                    // token.
                    .requestMatchers("/.well-known/**")
                    .permitAll()
                    .requestMatchers("/actuator/health/**")
                    .permitAll()
                    .requestMatchers("/api/**")
                    .hasAuthority("SCOPE_todo:api")
                    .requestMatchers("/mcp", "/mcp/**")
                    .hasAuthority("SCOPE_todo:mcp")
                    .anyRequest()
                    .permitAll())
        .oauth2ResourceServer(
            oauth2 ->
                oauth2
                    .authenticationEntryPoint(entryPoint)
                    .jwt(jwt -> {})
                    .protectedResourceMetadata(
                        metadata ->
                            metadata.protectedResourceMetadataCustomizer(
                                builder ->
                                    builder
                                        .resource(canonicalUri)
                                        .resourceName("One Minute To-Do List")
                                        // MCP requires at least one authorization server here.
                                        .authorizationServer(issuerUri)
                                        .scope("todo:mcp"))))
        .build();
  }
}
