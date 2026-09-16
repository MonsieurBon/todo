package ch.ethy.todo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import ch.ethy.todo.IntegrationTest;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Keeps the checked-in OpenAPI document equal to the one the application serves, since the web
 * app's TypeScript types are generated from it.
 *
 * <p>An intended change rewrites the file and fails once: review the diff and commit it.
 */
class OpenApiContractIT extends IntegrationTest {

  private static final Path CONTRACT = Path.of("src/main/webapp/api/openapi.json");

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
