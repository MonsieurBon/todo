package ch.ethy.todo.spike;

import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.stereotype.Component;

/**
 * Phase 0 spike only — gives the MCP server one tool so the transport can be exercised. Replaced by
 * the real, scope-gated tools in Phase 4.
 */
@Component
public class SpikeTools {

  @McpTool(name = "ping", description = "Health probe for the Phase 0 MCP spike.")
  public String ping() {
    return "pong";
  }
}
