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
      if (Array.isArray(result.content)) {
        const content: ReturnType<
          NonNullable<Tool["experimental_toToolResultContent"]>
        > = result.content;
        return content.map((x) => {
          // When data is not a https url, it is a base64 encoded image.
          // Replace it with a placeholder to prevent the window context from overflowing.
          if (x.type === "image" && x.data && !x.data.startsWith("https://")) {
            return {
              type: "text",
              text: "This is a placeholder for the screenshot, as the original base64 encoded image is too large to be displayed.",
            };
          }
          return x;
        });
      }

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
