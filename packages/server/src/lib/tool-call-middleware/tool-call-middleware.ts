import {
  type LanguageModelV1Middleware,
  type LanguageModelV1Prompt,
  type LanguageModelV1StreamPart,
  generateId,
} from "ai";
import { tracer } from "../../trace";
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

API INVOCATIONS

You are provided with api signatures within <api-list></api-list> XML tags in JSON schema format.
You are only allowed to call a single api at a time, if you need to call multiple apis, you must do it in a single batchCall api.
Do not make assumptions about what values to plug into apis; you must follow the api signature strictly to call apis.
Here are the available apis:
<api-list>
${tools}
</api-list>

For each api invocation return the arguments in JSON text format within api-request XML tags:

<api-request name="{arg-name}">
{argument-dict}
</api-request>

## OUTPUT FORMAT
Please remember you are not allowed to use any format related to api calling or fc or tool_code.
For each api request respone, you are only allowed to return the arguments in JSON text format within api-request XML tags as following:

<api-request name="{arg-name}">
{argument-dict}
</api-request>

### EXAMPLE OUTPUT 1
<api-request name="executeCommand">
{
  "command": "bun install"
}
</api-request>

### EXAMPLE OUTPUT 2
<api-request name="todoWrite">
{
  "todos": [
    {
      "id": "install-dependencies",
      "content": "Run 'bun install' to ensure all dependencies are installed.",
      "status": "pending",
      "priority": "high"
    },
    {
      "id": "implement-footer",
      "content": "Implement a basic Footer.",
      "status": "pending",
      "priority": "low"
    },
    {
      "id": "add-animations",
      "content": "Integrate framer-motion for animations.",
      "status": "pending",
      "priority": "medium"
    },
    {
      "id": "start-dev-server",
      "content": "Run 'bun dev' to start the development server.",
      "status": "pending",
      "priority": "low"
    }
  ]
}
</api-request>
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

        controller.enqueue({
          ...chunk,
          finishReason:
            streamingToolCalls.length > 0 ? "tool-calls" : chunk.finishReason,
        });
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
  const toolCallEndTag = "</api-request>";
  const toolResponseTagTemplate = (name: string) =>
    `<api-response name="${name}">`;
  const toolResponseEndTag = "</api-response>";
  const toolSystemPromptTemplate = defaultTemplate;

  // Pre-compile regex for better performance - new format with name attribute
  const toolCallStartRegex = /<api-request\s+name="([^"]+)">/;
  const toolCallStartPrefix = "<api-request";
  const toolCallRegex =
    /<api-request\s+name="([^"]+)">(.*?)(?:<\/api-request>|$)/gs;

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

      if (!result.text?.includes("<api-request")) {
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
                  text: `<api-request name="${content.toolName}">${JSON.stringify(content.args)}</api-request>`,
                };
              }

              return content;
            }),
          };
        }
        if (message.role === "tool") {
          return processToolResult(
            message,
            toolResponseTagTemplate,
            toolResponseEndTag,
          );
        }

        return message;
      }) as LanguageModelV1Prompt;

      // Appropriate fixes are needed as they are disappearing in LanguageModelV2
      const originalToolDefinitions =
        params.mode.type === "regular" && params.mode.tools
          ? params.mode.tools
          : {};

      const toolSystemPrompt = toolSystemPromptTemplate(
        JSON.stringify(originalToolDefinitions, null, 2),
      );

      const promptWithTools: LanguageModelV1Prompt =
        processedPrompt[0]?.role === "system"
          ? [
              {
                role: "system",
                content: `${toolSystemPrompt}\n\n${processedPrompt[0].content}`,
              },
              ...processedPrompt.slice(1),
            ]
          : [
              {
                role: "system",
                content: toolSystemPrompt,
              },
              ...processedPrompt,
            ];

      const stopSequences = params.stopSequences || [];
      stopSequences.push("</api-request>");

      tracer.setAttribute("ai.prompt.rawMessages", promptWithTools);

      return {
        ...params,
        mode: {
          // set the mode back to regular and remove the default tools.
          type: "regular",
        },
        stopSequences,
        prompt: promptWithTools,
      };
    },
  };
}

function processToolResult(
  tool: Extract<LanguageModelV1Prompt[number], { role: "tool" }>,
  toolResponseTagTemplate: (name: string) => string,
  toolResponseEndTag: string,
) {
  const content: Extract<
    LanguageModelV1Prompt[number],
    { role: "user" }
  >["content"] = [];

  for (const x of tool.content) {
    if (x.content && x.content.length > 0) {
      for (const part of x.content || []) {
        if (part.type === "image") {
          content.push({
            type: "image",
            mimeType: part.mimeType,
            image: Uint8Array.fromBase64(part.data),
          });
        } else {
          content.push(part as (typeof content)[number]);
        }
      }
    } else {
      content.push({
        type: "text",
        text: `${toolResponseTagTemplate(x.toolName)}${JSON.stringify(x.result)}${toolResponseEndTag}`,
      });
    }
  }

  return {
    role: "user",
    content,
  };
}
