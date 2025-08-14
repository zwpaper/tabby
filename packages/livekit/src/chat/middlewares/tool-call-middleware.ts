import { generateId } from "@ai-v5-sdk/ai";
import type {
  LanguageModelV2Middleware,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
} from "@ai-v5-sdk/provider";
import { getPotentialStartIndex } from "./utils";

export function createToolCallMiddleware(): LanguageModelV2Middleware {
  // Set defaults with validated config
  const toolCallEndTag = "</api-request>";
  const toolResponseTagTemplate = (name: string) =>
    `<api-response name="${name}">`;
  const toolResponseEndTag = "</api-response>";
  const toolSystemPromptTemplate = defaultTemplate;

  // Pre-compile regex for better performance - new format with name attribute
  const toolCallStartRegex = /<api-request\s+name="([^"]+)">/;
  const toolCallStartPrefix = "<api-request";

  return {
    middlewareVersion: "v2",
    async transformParams({ params }) {
      const processedPrompt = params.prompt.map((message) => {
        if (message.role === "assistant") {
          return {
            role: "assistant",
            content: message.content.map((content) => {
              if (content.type === "tool-call") {
                return {
                  type: "text",
                  text: `<api-request name="${content.toolName}">${JSON.stringify(content.input)}</api-request>`,
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
      }) as LanguageModelV2Prompt;

      // Appropriate fixes are needed as they are disappearing in LanguageModelV2
      const originalToolDefinitions = params.tools || [];

      const toolSystemPrompt = toolSystemPromptTemplate(
        JSON.stringify(originalToolDefinitions, null, 2),
      );

      const promptWithTools: LanguageModelV2Prompt =
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

      return {
        ...params,
        stopSequences,
        tools: undefined,
        prompt: promptWithTools,
      };
    },

    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();

      return {
        stream: stream.pipeThrough(
          createToolCallStream(
            toolCallStartRegex,
            toolCallStartPrefix,
            toolCallEndTag,
          ),
        ),
        ...rest,
      };
    },
  };
}

// Type to track streaming tool calls
type StreamingToolCall = {
  toolCallId: string;
  toolName: string;
  argTextBuffer: string;
  finalized: boolean;
};

function createToolCallStream(
  toolCallStartRegex: RegExp,
  toolCallStartPrefix: string,
  toolCallEndTag: string,
): TransformStream<LanguageModelV2StreamPart, LanguageModelV2StreamPart> {
  let isFirstToolCall = true;
  let isFirstText = true;
  let afterSwitch = false;
  let isToolCall = false;
  let buffer = "";
  let toolCallIndex = -1;

  let textId = "";
  let pendingTextStart:
    | Extract<LanguageModelV2StreamPart, { type: "text-start" }>
    | undefined = undefined;
  const streamingToolCalls: StreamingToolCall[] = [];

  return new TransformStream({
    transform(chunk, controller) {
      if (chunk.type === "finish") {
        // Process all collected tool calls
        for (const toolCall of streamingToolCalls) {
          if (toolCall.finalized) continue;
          controller.enqueue({
            type: "tool-call",
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: toolCall.argTextBuffer,
          });
        }

        controller.enqueue(chunk);
        return;
      }

      if (chunk.type === "text-start") {
        textId = chunk.id;
        pendingTextStart = chunk;
        return;
      }

      if (chunk.type === "text-end") {
        textId = "";
        // Skip entire text section if it's empty.
        if (pendingTextStart) {
          pendingTextStart = undefined;
          return;
        }
      }

      if (chunk.type !== "text-delta") {
        controller.enqueue(chunk);
        return;
      }

      buffer += chunk.delta;

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
                type: "tool-input-delta",
                id: streamingToolCall.toolCallId,
                delta: text,
              });
              streamingToolCall.argTextBuffer += text;
            }
          } else {
            if (pendingTextStart) {
              controller.enqueue(pendingTextStart);
              pendingTextStart = undefined;
            }

            controller.enqueue({
              id: textId,
              type: "text-delta",
              delta: prefix + text,
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
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                input: toolCall.argTextBuffer,
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

            controller.enqueue({
              type: "tool-input-start",
              id: toolCallId,
              toolName,
            });

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

function processToolResult(
  tool: Extract<LanguageModelV2Prompt[number], { role: "tool" }>,
  toolResponseTagTemplate: (name: string) => string,
  toolResponseEndTag: string,
) {
  const content: Extract<
    LanguageModelV2Prompt[number],
    { role: "user" }
  >["content"] = [];

  for (const x of tool.content) {
    if (x.output && x.output.type === "content") {
      for (const part of x.output.value || []) {
        if (part.type === "media") {
          content.push({
            type: "file",
            mediaType: part.mediaType,
            data: part.data,
          });
        } else {
          content.push(part as (typeof content)[number]);
        }
      }
    } else {
      content.push({
        type: "text",
        text: `${toolResponseTagTemplate(x.toolName)}${JSON.stringify(x.output)}${toolResponseEndTag}`,
      });
    }
  }

  return {
    role: "user",
    content,
  };
}

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
