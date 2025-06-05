import {
  type LanguageModelV1Middleware,
  type LanguageModelV1Prompt,
  type LanguageModelV1StreamPart,
  generateId,
} from "ai";
import * as RJSON from "./relaxed-json";
import { getPotentialStartIndex } from "./utils";

interface ParsedToolCall {
  name: string;
  arguments: unknown;
}

// Custom error classes for structured error handling
class ToolCallParseError extends Error {
  public readonly cause?: Error;

  constructor(
    message: string,
    public readonly toolCall: string,
    cause?: Error,
  ) {
    super(message);
    this.name = "ToolCallParseError";
    this.cause = cause;
  }
}

class ToolCallValidationError extends Error {
  constructor(
    message: string,
    public readonly toolCall: ParsedToolCall,
  ) {
    super(message);
    this.name = "ToolCallValidationError";
  }
}

const defaultTemplate = (tools: string) =>
  `====

TOOL CALLING

You are provided with function signatures within <tools></tools> XML tags.
You may call one or more functions to assist with the user query.
Don't make assumptions about what values to plug into functions.
Here are the available tools: <tools>${tools}</tools>
Use the following pydantic model json schema for each tool call you will make: {'title': 'FunctionCall', 'type': 'object', 'properties': {'arguments': {'title': 'Arguments', 'type': 'object'}, 'name': {'title': 'Name', 'type': 'string'}}, 'required': ['arguments', 'name']}
For each function call return a json object with function name and arguments within <tool_call></tool_call> XML tags as follows:
<tool-call>
{'arguments': <args-dict>, 'name': <function-name>}
</tool-call>`;

// Constants for performance and memory management
const MaxBufferSize = 4 * 1024 * 1024; // 4MB limit
const MaxToolCall = 100; // Reasonable limit for tool calls

// Utility functions
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateParsedToolCall(toolCall: ParsedToolCall): void {
  if (!toolCall.name || typeof toolCall.name !== "string") {
    throw new ToolCallValidationError(
      "Invalid tool call: missing or invalid name",
      toolCall,
    );
  }
  if (toolCall.name.length === 0) {
    throw new ToolCallValidationError(
      "Invalid tool call: empty tool name",
      toolCall,
    );
  }
}

// Extract tool call parsing logic for better maintainability
function parseToolCallSafely(toolCall: string): ParsedToolCall {
  try {
    const parsedToolCall = RJSON.parse(toolCall) as ParsedToolCall;
    validateParsedToolCall(parsedToolCall);
    return parsedToolCall;
  } catch (e) {
    if (e instanceof ToolCallValidationError) {
      throw e;
    }
    throw new ToolCallParseError(
      `Failed to parse tool call: ${e instanceof Error ? e.message : String(e)}`,
      toolCall,
      e instanceof Error ? e : undefined,
    );
  }
}

// Extract tool call processing logic for wrapGenerate
function extractToolCallsFromText(
  text: string,
  toolCallRegex: RegExp,
): ParsedToolCall[] {
  const matches = [...text.matchAll(toolCallRegex)];
  const toolCallTexts = matches.map((match) => match[1] || match[2]);

  return toolCallTexts.map(parseToolCallSafely);
}

// Extract stream transform logic for better organization
function createToolCallTransformStream(
  toolCallTag: string,
  toolCallEndTag: string,
): TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart> {
  let isFirstToolCall = true;
  let isFirstText = true;
  let afterSwitch = false;
  let isToolCall = false;
  let buffer = "";
  let toolCallIndex = -1;
  const toolCallBuffer: string[] = [];

  return new TransformStream<
    LanguageModelV1StreamPart,
    LanguageModelV1StreamPart
  >({
    transform(chunk, controller) {
      if (chunk.type === "finish") {
        // Process all collected tool calls
        for (const toolCallText of toolCallBuffer) {
          if (!toolCallText) continue;

          try {
            const parsedToolCall = parseToolCallSafely(toolCallText);

            controller.enqueue({
              type: "tool-call",
              toolCallType: "function",
              toolCallId: generateId(),
              toolName: parsedToolCall.name,
              args: JSON.stringify(parsedToolCall.arguments),
            });
          } catch (e) {
            const error =
              e instanceof ToolCallParseError ||
              e instanceof ToolCallValidationError
                ? e
                : new ToolCallParseError(
                    `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
                    toolCallText,
                    e instanceof Error ? e : undefined,
                  );

            // Provide helpful error message to user
            controller.enqueue({
              type: "error",
              error,
            });
          }
        }

        controller.enqueue(chunk);
        return;
      }

      if (chunk.type !== "text-delta") {
        controller.enqueue(chunk);
        return;
      }

      buffer += chunk.textDelta;

      // Check for buffer size limit
      if (buffer.length > MaxBufferSize) {
        console.warn("Buffer size exceeded, truncating content");
        controller.enqueue({
          type: "error",
          error: new Error("ToolCall buffer size exceeded"),
        });
        buffer = buffer.slice(-MaxBufferSize / 2); // Keep last half
      }

      function publish(text: string) {
        if (text.length > 0) {
          const prefix =
            afterSwitch && (isToolCall ? !isFirstToolCall : !isFirstText)
              ? "\n" // separator
              : "";

          if (isToolCall) {
            if (!toolCallBuffer[toolCallIndex]) {
              toolCallBuffer[toolCallIndex] = "";
            }
            toolCallBuffer[toolCallIndex] += text;
          } else {
            controller.enqueue({
              type: "text-delta",
              textDelta: prefix + text,
            });
          }

          afterSwitch = false;

          if (isToolCall) {
            isFirstToolCall = false;
          } else {
            isFirstText = false;
          }
        }
      }

      do {
        const nextTag = isToolCall ? toolCallEndTag : toolCallTag;
        const startIndex = getPotentialStartIndex(buffer, nextTag);

        // no opening or closing tag found, publish the buffer
        if (startIndex == null) {
          publish(buffer);
          buffer = "";
          break;
        }

        // publish text before the tag
        publish(buffer.slice(0, startIndex));

        const foundFullMatch = startIndex + nextTag.length <= buffer.length;

        if (foundFullMatch) {
          buffer = buffer.slice(startIndex + nextTag.length);
          toolCallIndex++;

          // Check for too many tool calls
          if (toolCallIndex >= MaxToolCall) {
            console.warn("Maximum tool calls limit reached");
            controller.enqueue({
              type: "error",
              error: new Error(" Maximum tool calls limit reached"),
            });
            break;
          }

          isToolCall = !isToolCall;
          afterSwitch = true;
        } else {
          buffer = buffer.slice(startIndex);
          break;
        }
        // biome-ignore lint/correctness/noConstantCondition: <explanation>
      } while (true);
    },
  });
}

export function createToolMiddleware(): LanguageModelV1Middleware {
  // Set defaults with validated config
  const toolCallTag = "<tool-call>";
  const toolCallEndTag = "</tool-call>";
  const toolResponseTag = "<tool-response>";
  const toolResponseEndTag = "</tool-response>";
  const toolSystemPromptTemplate = defaultTemplate;

  // Pre-compile regex for better performance
  const toolCallRegex = new RegExp(
    `${escapeRegex(toolCallTag)}(.*?)(?:${escapeRegex(toolCallEndTag)}|$)`,
    "gs",
  );

  return {
    middlewareVersion: "v1",
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();
      const transformStream = createToolCallTransformStream(
        toolCallTag,
        toolCallEndTag,
      );

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    },

    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();

      if (!result.text?.includes(toolCallTag)) {
        return result;
      }

      try {
        const parsedToolCalls = extractToolCallsFromText(
          result.text,
          toolCallRegex,
        );

        return {
          ...result,
          // TODO: Return the remaining value after extracting the tool call tag.
          text: "",
          toolCalls: parsedToolCalls.map((parsedToolCall) => ({
            toolCallType: "function" as const,
            toolCallId: generateId(),
            toolName: parsedToolCall.name,
            args: RJSON.stringify(parsedToolCall.arguments),
          })),
        };
      } catch (e) {
        console.error("Failed to process tool calls in wrapGenerate", e);
        // Return original result if tool call processing fails
        return result;
      }
    },

    transformParams: async ({ params }) => {
      const processedPrompt = params.prompt.map((message) => {
        if (message.role === "assistant") {
          return {
            role: "assistant",
            content: message.content.map((content) => {
              if (content.type === "tool-call") {
                return {
                  type: "text",
                  text: `${toolCallTag}${JSON.stringify({
                    arguments: content.args,
                    name: content.toolName,
                  })}${toolCallEndTag}`,
                };
              }

              return content;
            }),
          };
        }
        if (message.role === "tool") {
          return {
            role: "user",
            content: [
              {
                type: "text",
                text: message.content
                  .map(
                    (content) =>
                      `${toolResponseTag}${JSON.stringify({
                        toolName: content.toolName,
                        result: content.result,
                      })}${toolResponseEndTag}`,
                  )
                  .join("\n"),
              },
            ],
          };
        }

        return message;
      }) as LanguageModelV1Prompt;

      // Appropriate fixes are needed as they are disappearing in LanguageModelV2
      const originalToolDefinitions =
        params.mode.type === "regular" && params.mode.tools
          ? params.mode.tools
          : {};

      const HermesPrompt = toolSystemPromptTemplate(
        JSON.stringify(Object.entries(originalToolDefinitions)),
      );

      const toolSystemPrompt: LanguageModelV1Prompt =
        processedPrompt[0]?.role === "system"
          ? [
              {
                role: "system",
                content: `${HermesPrompt}\n\n${processedPrompt[0].content}`,
              },
              ...processedPrompt.slice(1),
            ]
          : [
              {
                role: "system",
                content: HermesPrompt,
              },
              ...processedPrompt,
            ];

      return {
        ...params,
        mode: {
          // set the mode back to regular and remove the default tools.
          type: "regular",
        },
        prompt: toolSystemPrompt,
      };
    },
  };
}
