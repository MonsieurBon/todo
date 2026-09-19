package ch.ethy.todo.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.mcp.annotation.McpTool;

/**
 * The protocol defines destructiveHint = false as "performs only additive updates", and clients
 * decide from it whether to ask before running a tool.
 */
class TodoToolsAnnotationsTest {

  private static final Set<String> READ_ONLY =
      Set.of("get_board", "list_labels", "list_tasklists", "get_review_queue");

  private static final Set<String> ADDITIVE =
      Set.of("create_task", "create_tasklist", "share_tasklist");

  private static List<McpTool> tools() {
    return Arrays.stream(TodoTools.class.getMethods())
        .map(m -> m.getAnnotation(McpTool.class))
        .filter(t -> t != null)
        .toList();
  }

  @Test
  @DisplayName("only the tools that change nothing claim to be read-only")
  void readOnlyToolsAreExactlyTheReads() {
    assertThat(tools())
        .filteredOn(t -> t.annotations().readOnlyHint())
        .extracting(McpTool::name)
        .containsExactlyInAnyOrderElementsOf(READ_ONLY);
  }

  @Test
  @DisplayName("every tool that changes something other than by adding is flagged destructive")
  void onlyAdditiveToolsAreNonDestructive() {
    assertThat(tools())
        .filteredOn(t -> !t.annotations().readOnlyHint())
        .filteredOn(t -> !t.annotations().destructiveHint())
        .extracting(McpTool::name)
        .containsExactlyInAnyOrderElementsOf(ADDITIVE);
  }
}
