package ch.ethy.todo.web;

import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/** Serves the built web app, handing unknown paths to it so client routes survive a reload. */
@Configuration
public class WebConfig implements WebMvcConfigurer {

  /**
   * These must 404 rather than answer HTML: a JSON client given index.html reports a parse error.
   */
  private static final List<String> SERVER_OWNED =
      List.of("api", "mcp", "actuator", "v3", "swagger-ui", ".well-known");

  /**
   * Both halves matter: without the exact match the bare {@code /api} falls through to the web app,
   * and without the trailing slash {@code /api-docs-elsewhere} is captured by {@code api}.
   */
  private static boolean belongsToTheServer(String path) {
    return SERVER_OWNED.stream().anyMatch(root -> path.equals(root) || path.startsWith(root + "/"));
  }

  private static final ClassPathResource INDEX = new ClassPathResource("static/index.html");

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry
        .addResourceHandler("/**")
        .addResourceLocations("classpath:/static/")
        .resourceChain(true)
        .addResolver(
            new PathResourceResolver() {
              @Override
              protected Resource getResource(String path, Resource location) throws IOException {
                Resource requested = location.createRelative(path);
                if (requested.exists() && requested.isReadable()) {
                  return requested;
                }
                if (belongsToTheServer(path)) {
                  return null;
                }
                // Null rather than a missing resource: the handler reads last-modified off what it
                // is given, so an unbuilt checkout would answer 500 instead of 404.
                return INDEX.exists() ? INDEX : null;
              }
            });
  }
}
