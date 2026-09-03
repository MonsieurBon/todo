package ch.ethy.todo.web;

import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the built web app, and hands every unknown path to it.
 *
 * <p>The client routes {@code /capture}, {@code /review} and {@code /lists} itself, so a hard
 * reload — or the Android share target, which opens {@code /capture} directly — has to reach
 * index.html rather than a 404. Installed to a home screen there is no address bar to recover from
 * one, which makes this load-bearing rather than cosmetic.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

  /**
   * Path roots that belong to the server and must 404 honestly rather than answer with an HTML
   * page. A JSON client that receives index.html reports a parse error, which is a considerably
   * worse way to learn a URL is wrong.
   */
  private static final List<String> SERVER_OWNED =
      List.of("api", "mcp", "actuator", "v3", "swagger-ui", ".well-known");

  /**
   * Matches the root itself as well as anything beneath it.
   *
   * <p>Both halves are load-bearing. Without the exact match, {@code /api} and {@code /actuator} —
   * the bare roots, which people type — fall through to the web app and answer 200 with HTML.
   * Without the trailing slash on the prefix, {@code /api-docs-elsewhere} would be captured by
   * {@code api}.
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
                // Null rather than a resource that is not there: the handler asks a returned
                // resource for its last-modified time, so a missing index.html would be a 500
                // instead of a 404 on every request in a checkout where the app is not built.
                return INDEX.exists() ? INDEX : null;
              }
            });
  }
}
