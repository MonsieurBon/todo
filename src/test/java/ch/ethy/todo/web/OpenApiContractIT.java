package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Keeps the checked-in OpenAPI document equal to the one this application actually serves.
 *
 * <p>The web app's TypeScript types are generated from that file at build time, so it is the only
 * thing standing between a renamed field and a frontend that compiles happily against a shape the
 * server stopped sending. Choosing Java for the backend and TypeScript for the frontend means the
 * DTOs exist twice; this is what stops the second copy from drifting.
 *
 * <p>When the API changes on purpose, this test rewrites the file and fails once. Review the diff
 * and commit it — the failure is the review prompt, not a defect.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class OpenApiContractIT {

  private static final Path CONTRACT = Path.of("src/main/webapp/api/openapi.json");

  @Container
  @SuppressWarnings("resource")
  static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4").withDatabaseName("todo");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
    registry.add("spring.datasource.username", MYSQL::getUsername);
    registry.add("spring.datasource.password", MYSQL::getPassword);
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @MockitoBean private JwtDecoder jwtDecoder;

  @Autowired private MockMvc mvc;

  /** Sorted keys, so the file is a diffable contract rather than a reflection-order snapshot. */
  private static final ObjectMapper CANONICAL =
      JsonMapper.builder()
          .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
          .enable(SerializationFeature.INDENT_OUTPUT)
          .build();

  @Test
  @DisplayName("the checked-in OpenAPI document is the one the server serves")
  void contractIsCurrent() throws Exception {
    String served = mvc.perform(get("/v3/api-docs")).andReturn().getResponse().getContentAsString();
    // Read into plain maps rather than a JsonNode tree: ORDER_MAP_ENTRIES_BY_KEYS sorts
    // java.util.Map, and an ObjectNode keeps its insertion order regardless.
    @SuppressWarnings("unchecked")
    var document = (java.util.Map<String, Object>) CANONICAL.readValue(served, java.util.Map.class);
    // The server list is whatever host answered, which is not part of the contract.
    document.remove("servers");
    String current = CANONICAL.writeValueAsString(document) + "\n";

    String checkedIn = Files.exists(CONTRACT) ? Files.readString(CONTRACT) : "";
    if (!current.equals(checkedIn)) {
      Files.createDirectories(CONTRACT.getParent());
      Files.writeString(CONTRACT, current);
    }

    assertThat(current)
        .as(
            "%s was out of date and has been rewritten. Review the diff, run `npm run api:types`,"
                + " and commit both.",
            CONTRACT)
        .isEqualTo(checkedIn);
  }
}
