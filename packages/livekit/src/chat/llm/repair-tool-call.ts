import {
  NoSuchToolError,
  type ToolCallRepairFunction,
  streamText,
} from "@ai-v5-sdk/ai";
import type { LanguageModelV2 } from "@ai-v5-sdk/provider";
import type { ClientToolsV5Type } from "@getpochi/tools";

export const makeRepairToolCall: (
  model: LanguageModelV2,
) => ToolCallRepairFunction<ClientToolsV5Type> =
  (model) =>
  async ({ toolCall, inputSchema, error }) => {
    if (NoSuchToolError.isInstance(error)) {
      return null; // do not attempt to fix invalid tool names
    }

    const result = await streamText({
      model,
      prompt: [
        `The model tried to call the tool "${toolCall.toolName}" with the following arguments:`,
        JSON.stringify(toolCall.input),
        "The tool accepts the following schema:",
        JSON.stringify(inputSchema(toolCall)),
        "Please fix the arguments. Please ONLY output the json string, without any other text (no markdown code block wrapper, either)",
      ].join("\n"),
    });

    let text = "";
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    return { ...toolCall, input: text };
  };
