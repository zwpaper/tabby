import {
  type LanguageModelV1Middleware,
  type LanguageModelV1Prompt,
  type LanguageModelV1StreamPart,
  generateId,
} from "ai";
import { getPotentialStartIndex } from "./utils";

interface ParsedToolCall {
  name: string;
  arguments: string;
}

// Type to track streaming tool calls
type StreamingToolCall = {
  toolCallId: string;
  toolName: string;
  argTextBuffer: string;
  finalized: boolean;
};

const defaultTemplate = (tools: string) =>
  `====

TOOL CALLING

You are provided with function signatures within <tools></tools> XML tags in JSON schema format.
You may call one or more functions to assist with the user query.
Do not make assumptions about what values to plug into functions; you must follow the function signature strictly to call functions.
Here are the available tools:
<tools>
${tools}
</tools>

For each function call return the arguments in JSON text format within tool-call XML tags:

<tool-call name="{arg-name}">
{argument-dict}
</tool-call>
`;

// Extract tool call processing logic for wrapGenerate
function extractToolCallsFromText(
  text: string,
  toolCallRegex: RegExp,
): ParsedToolCall[] {
  const matches = [...text.matchAll(toolCallRegex)];
  return matches.map((match) => {
    const toolName = match[1];
    const argsText = match[2];

    return { name: toolName, arguments: argsText };
  });
}

// Extract stream transform logic for better organization
function createToolCallTransformStream(
  toolCallStartRegex: RegExp,
  toolCallStartPrefix: string,
  toolCallEndTag: string,
): TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart> {
  let isFirstToolCall = true;
  let isFirstText = true;
  let afterSwitch = false;
  let isToolCall = false;
  let buffer = "";
  let toolCallIndex = -1;
  const streamingToolCalls: StreamingToolCall[] = [];

  return new TransformStream<
    LanguageModelV1StreamPart,
    LanguageModelV1StreamPart
  >({
    transform(chunk, controller) {
      if (chunk.type === "finish") {
        // Process all collected tool calls
        for (const toolCall of streamingToolCalls) {
          if (toolCall.finalized) continue;
          controller.enqueue({
            type: "tool-call",
            toolCallType: "function",
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.argTextBuffer,
          });
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
      function publish(text: string) {
        if (text.length > 0) {
          const prefix =
            afterSwitch && (isToolCall ? !isFirstToolCall : !isFirstText)
              ? "\n" // separator
              : "";

          if (isToolCall) {
            const streamingToolCall = streamingToolCalls[toolCallIndex];
            if (streamingToolCall) {
              controller.enqueue({
                type: "tool-call-delta",
                toolCallType: "function",
                toolCallId: streamingToolCall.toolCallId,
                toolName: streamingToolCall.toolName,
                argsTextDelta: text,
              });
              streamingToolCall.argTextBuffer += text;
            }
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
        if (isToolCall) {
          // Look for closing tag
          const endIndex = getPotentialStartIndex(buffer, toolCallEndTag);

          if (endIndex == null) {
            publish(buffer);
            buffer = "";
            break;
          }

          // publish text before the end tag
          publish(buffer.slice(0, endIndex));

          const foundFullEndMatch =
            endIndex + toolCallEndTag.length <= buffer.length;

          if (foundFullEndMatch) {
            buffer = buffer.slice(endIndex + toolCallEndTag.length);
            isToolCall = false;
            afterSwitch = true;
          } else {
            buffer = buffer.slice(endIndex);
            break;
          }
        } else {
          // Look for opening tag with name attribute
          const match = buffer.match(toolCallStartRegex);

          if (!match) {
            const startIndex = getPotentialStartIndex(
              buffer,
              toolCallStartPrefix,
            );
            if (startIndex === null || startIndex < 0) {
              publish(buffer);
              buffer = "";
            }
            break;
          }

          const startIndex = match.index ?? 0;
          const fullMatch = match[0];
          const toolName = match[1];

          // publish text before the tag
          publish(buffer.slice(0, startIndex));

          const foundFullStartMatch =
            startIndex + fullMatch.length <= buffer.length;

          if (foundFullStartMatch) {
            buffer = buffer.slice(startIndex + fullMatch.length);
            // Finalizing the previous tool call
            if (toolCallIndex >= 0) {
              const toolCall = streamingToolCalls[toolCallIndex];
              toolCall.finalized = true;
              controller.enqueue({
                type: "tool-call",
                toolCallType: "function",
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                args: toolCall.argTextBuffer,
              });
            }
            toolCallIndex++;

            // Create new streaming tool call
            const toolCallId = generateId();
            streamingToolCalls[toolCallIndex] = {
              toolCallId,
              toolName,
              argTextBuffer: "",
              finalized: false,
            };

            isToolCall = true;
            afterSwitch = true;
          } else {
            buffer = buffer.slice(startIndex);
            break;
          }
        }
        // biome-ignore lint/correctness/noConstantCondition: This loop intentionally runs indefinitely, processing the buffer in chunks until no more complete tags can be found. The loop breaks internally based on buffer content and parsing progress.
      } while (true);
    },
  });
}

export function createToolMiddleware(): LanguageModelV1Middleware {
  // Set defaults with validated config
  const toolCallEndTag = "</tool-call>";
  const toolResponseTagTemplate = (name: string) =>
    `<tool-response name="${name}">`;
  const toolResponseEndTag = "</tool-response>";
  const toolSystemPromptTemplate = defaultTemplate;

  // Pre-compile regex for better performance - new format with name attribute
  const toolCallStartRegex = /<tool-call\s+name="([^"]+)">/;
  const toolCallStartPrefix = "<tool-call";
  const toolCallRegex =
    /<tool-call\s+name="([^"]+)">(.*?)(?:<\/tool-call>|$)/gs;

  return {
    middlewareVersion: "v1",
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();
      const transformStream = createToolCallTransformStream(
        toolCallStartRegex,
        toolCallStartPrefix,
        toolCallEndTag,
      );

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      };
    },

    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();

      if (!result.text?.includes("<tool-call")) {
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
            args: parsedToolCall.arguments,
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
                  text: `<tool-call name="${content.toolName}">${JSON.stringify(content.args)}</tool-call>`,
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
                      `${toolResponseTagTemplate(content.toolName)}${JSON.stringify(
                        content.result,
                      )}${toolResponseEndTag}`,
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

      const systemPrompt = toolSystemPromptTemplate(
        JSON.stringify(originalToolDefinitions, null, 2),
      );

      const toolSystemPrompt: LanguageModelV1Prompt =
        processedPrompt[0]?.role === "system"
          ? [
              {
                role: "system",
                content: `${systemPrompt}\n\n${processedPrompt[0].content}`,
              },
              ...processedPrompt.slice(1),
            ]
          : [
              {
                role: "system",
                content: systemPrompt,
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
