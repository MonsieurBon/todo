package ch.ethy.todo;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.MySQLContainer;

/**
 * One database and one application context for every integration test.
 *
 * <p>A container per test class costs half a minute each, and — because the datasource URL differs
 * every time — defeats Spring's context cache, so the application starts again for each one too.
 * Sharing both turns the suite from minutes into seconds. The container is deliberately never
 * stopped: Testcontainers' reaper removes it when the JVM exits.
 *
 * <p>The price is that tests share a schema, so nothing here may assume an empty database. Every
 * test invents its own user instead, which is also what makes them safe to run in any order.
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class IntegrationTest {

  @SuppressWarnings("resource")
  public static final MySQLContainer<?> MYSQL =
      new MySQLContainer<>("mysql:8.4").withDatabaseName("todo");

  static {
    MYSQL.start();
  }

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
    registry.add("spring.datasource.username", MYSQL::getUsername);
    registry.add("spring.datasource.password", MYSQL::getPassword);
    // Flyway owns the schema; letting Hibernate verify it is the only thing that catches a
    // hand-written migration drifting from the entities.
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  /** No IdP in tests: every test authenticates directly, so nothing ever decodes a real token. */
  @MockitoBean private JwtDecoder jwtDecoder;
}
