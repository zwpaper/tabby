import { jsonSchema } from "@ai-sdk/ui-utils";
import { type Tool, tool } from "ai";
import type { JSONSchema7 } from "json-schema";
import { z } from "zod";

export const ZodMcpToolType = z.object({
  description: z
    .string()
    .optional()
    .describe("An optional description of the MCP tool."),
  parameters: z
    .object({
      jsonSchema: z.custom<JSONSchema7>().describe("Validated json schema."),
    })
    .required()
    .describe("The parameters of the MCP tool."),
});

type McpTool = z.infer<typeof ZodMcpToolType>;

function parseMcpTool(name: string, mcpTool: McpTool): Tool {
  let toToolResultContent: Tool["experimental_toToolResultContent"];
  if (name === "browser_take_screenshot") {
    toToolResultContent = (result) => {
      return result.content;
    };
  }
  return tool({
    description: mcpTool.description,
    parameters: jsonSchema(mcpTool.parameters.jsonSchema),
    experimental_toToolResultContent: toToolResultContent,
  });
}

export function parseMcpToolSet(
  mcpToolSet: Record<string, McpTool> | undefined,
): Record<string, Tool> | undefined {
  return mcpToolSet
    ? Object.fromEntries(
        Object.entries(mcpToolSet).map(([name, tool]) => [
          name,
          parseMcpTool(name, tool),
        ]),
      )
    : undefined;
}
