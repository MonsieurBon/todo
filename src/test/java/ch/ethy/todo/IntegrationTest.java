package ch.ethy.todo;

import java.sql.SQLException;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.MySQLContainer;

/**
 * One database and one application context for every integration test — a container per class also
 * defeats Spring's context cache, since the datasource URL differs every time.
 *
 * <p>So tests share a schema and none may assume an empty database. Each invents its own user,
 * which is also what makes them safe in any order.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(IntegrationTest.Clocks.class)
public abstract class IntegrationTest {

  @SuppressWarnings("resource")
  public static final MySQLContainer<?> MYSQL =
      new MySQLContainer<>("mysql:8.4").withDatabaseName("todo").withReuse(true);

  static {
    MYSQL.start();
    emptyDatabase();
  }

  /**
   * A reused container keeps the last run's schema, and a migration changed since then fails
   * Flyway's validation in every context that migrates. Starting empty is what CI does.
   */
  private static void emptyDatabase() {
    try (var connection = MYSQL.createConnection("");
        var statement = connection.createStatement()) {
      statement.execute("DROP DATABASE " + MYSQL.getDatabaseName());
      statement.execute("CREATE DATABASE " + MYSQL.getDatabaseName());
    } catch (SQLException e) {
      throw new IllegalStateException("Could not empty the test database", e);
    }
  }

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
    registry.add("spring.datasource.username", MYSQL::getUsername);
    registry.add("spring.datasource.password", MYSQL::getPassword);
    // The only thing that catches a hand-written migration drifting from the entities.
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @MockitoBean protected JwtDecoder jwtDecoder;

  @Autowired protected TestClock clock;

  /** The context is shared, so time a test moved on must not carry into the next one. */
  @AfterEach
  void backToNow() {
    clock.reset();
  }

  @TestConfiguration
  static class Clocks {
    @Bean
    @Primary
    TestClock testClock() {
      return new TestClock();
    }
  }
}
