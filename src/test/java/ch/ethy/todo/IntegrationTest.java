package ch.ethy.todo;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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
    // The only thing that catches a hand-written migration drifting from the entities.
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @MockitoBean protected JwtDecoder jwtDecoder;
}
