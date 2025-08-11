import { type Tool, jsonSchema, tool } from "@ai-v5-sdk/provider-utils";
import type { McpTool } from "@getpochi/tools";

function parseMcpTool(mcpTool: McpTool): Tool {
  return tool({
    description: mcpTool.description,
    inputSchema: jsonSchema(mcpTool.inputSchema.jsonSchema),
  });
}

export function parseMcpToolSet(
  mcpToolSet: Record<string, McpTool> | undefined,
): Record<string, Tool> | undefined {
  return mcpToolSet
    ? Object.fromEntries(
        Object.entries(mcpToolSet).map(([name, tool]) => [
          name,
          parseMcpTool(tool),
        ]),
      )
    : undefined;
}
