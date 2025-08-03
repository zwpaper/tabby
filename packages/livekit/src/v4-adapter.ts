/**
 * Helpers to convert v4 messages to v5 messages
 */

import { type Tool, asSchema, getToolName, isToolUIPart } from "@ai-v5-sdk/ai";
import { ClientToolsV5 } from "@getpochi/tools";
import type { DBMessage } from "@ragdoll/db";
import type { Message } from "./types";

export async function fromDBMessage(x: DBMessage): Promise<Message> {
  if (x.role === "data") {
    throw new Error("Data messages are not supported in v5");
  }

  const parts: Message["parts"] = [];
  for (const part of x.parts) {
    switch (part.type) {
      case "reasoning":
        parts.push({
          type: "reasoning",
          text: part.reasoning,
        });
        break;
      case "step-start":
        parts.push({
          type: "step-start",
        });
        break;
      case "text":
        parts.push({
          type: "text",
          text: part.text,
        });
        break;
      case "checkpoint":
        parts.push({
          type: "data-checkpoint",
          data: {
            commit: part.checkpoint.commit,
          },
        });
        break;
      case "tool-invocation":
        {
          const { toolInvocation } = part;
          const toolName =
            toolInvocation.toolName as keyof typeof ClientToolsV5;
          if (toolName in ClientToolsV5) {
            const toolPart = await createToolPart(
              toolInvocation,
              ClientToolsV5[toolName],
            );
            parts.push(toolPart);
          } else {
            parts.push(createDynamicToolPart(toolInvocation));
          }
        }
        break;
      case "file":
        throw new Error("File parts are not supported yet");
      default:
        assertUnreachable(part);
    }
  }

  for (const attachment of x.experimental_attachments || []) {
    parts.push({
      type: "file",
      filename: attachment.name,
      url: attachment.url,
      mediaType: attachment.contentType || "image/jpeg",
    });
  }

  return {
    id: x.id,
    role: x.role,
    parts,
  };
}

export function toDBMessage(message: Message): DBMessage {
  const parts: DBMessage["parts"] = [];
  const attachments: DBMessage["experimental_attachments"] = [];

  for (const part of message.parts) {
    switch (part.type) {
      case "text":
        parts.push({ type: "text", text: part.text });
        break;
      case "reasoning":
        parts.push({ type: "reasoning", reasoning: part.text, details: [] });
        break;
      case "step-start":
        parts.push({ type: "step-start" });
        break;
      case "file":
        attachments.push({
          name: part.filename,
          url: part.url,
          contentType: part.mediaType,
        });
        break;
      case "data-checkpoint":
        parts.push({
          type: "checkpoint",
          checkpoint: {
            commit: part.data.commit,
          },
        });
        break;
      case "source-document":
      case "source-url":
        throw new Error("Unsupported part type");
      default:
        if (part.type === "dynamic-tool" || isToolUIPart(part)) {
          const toolName =
            part.type === "dynamic-tool" ? part.toolName : getToolName(part);
          const base = {
            toolCallId: part.toolCallId,
            toolName,
            args: part.input,
          };
          switch (part.state) {
            case "input-streaming":
              parts.push({
                type: "tool-invocation",
                toolInvocation: { ...base, state: "partial-call" },
              });
              break;
            case "input-available":
              parts.push({
                type: "tool-invocation",
                toolInvocation: { ...base, state: "call" },
              });
              break;
            case "output-available":
              parts.push({
                type: "tool-invocation",
                toolInvocation: {
                  ...base,
                  state: "result",
                  result: part.output,
                },
              });
              break;
            case "output-error":
              parts.push({
                type: "tool-invocation",
                toolInvocation: {
                  ...base,
                  state: "result",
                  result: { error: part.errorText },
                },
              });
              break;
            default:
              assertUnreachable(part);
          }
          break;
        }

        assertUnreachable(part);
    }
  }

  return {
    id: message.id,
    role: message.role,
    parts,
    experimental_attachments: attachments,
  };
}

async function createToolPart(
  toolInvocation: Extract<
    DBMessage["parts"][number],
    { type: "tool-invocation" }
  >["toolInvocation"],
  tool: Tool,
): Promise<Message["parts"][number]> {
  const schema = asSchema(tool.inputSchema);
  if (schema.validate) {
    const result = await schema.validate(toolInvocation.args);
    if (!result.success) {
      throw result.error;
    }
  }
  const base = {
    type: `tool-${toolInvocation.toolName}` as const,
    toolCallId: toolInvocation.toolCallId,
    input: toolInvocation.args,
  };

  switch (toolInvocation.state) {
    case "partial-call":
      // @ts-expect-error
      return { ...base, state: "input-streaming" as const };
    case "call":
      // @ts-expect-error
      return { ...base, state: "input-available" as const };
    case "result": {
      if (
        typeof toolInvocation.result === "object" &&
        toolInvocation.result &&
        "error" in toolInvocation.result &&
        typeof toolInvocation.result.error === "string"
      ) {
        // @ts-expect-error
        return {
          ...base,
          state: "output-error",
          errorText: toolInvocation.result.error,
        };
      }

      const schema = asSchema(tool.outputSchema);
      if (schema.validate) {
        const result = await schema.validate(toolInvocation.result);
        if (!result.success) {
          throw result.error;
        }
      }
      // @ts-expect-error
      return {
        ...base,
        state: "output-available",
        output: toolInvocation.result,
      };
    }
    default:
      assertUnreachable(toolInvocation);
  }
}

function createDynamicToolPart(
  toolInvocation: Extract<
    DBMessage["parts"][number],
    { type: "tool-invocation" }
  >["toolInvocation"],
): Message["parts"][number] {
  const base = {
    type: "dynamic-tool" as const,
    toolCallId: toolInvocation.toolCallId,
    toolName: toolInvocation.toolName,
    input: toolInvocation.args,
  };

  switch (toolInvocation.state) {
    case "partial-call":
      return { ...base, state: "input-streaming" };
    case "call":
      return { ...base, state: "input-available" };
    case "result":
      if (
        typeof toolInvocation.result === "object" &&
        toolInvocation.result &&
        "error" in toolInvocation.result &&
        typeof toolInvocation.result.error === "string"
      ) {
        return {
          ...base,
          state: "output-error",
          errorText: toolInvocation.result.error,
        };
      }
      return {
        ...base,
        state: "output-available",
        output: toolInvocation.result,
      };
    default:
      assertUnreachable(toolInvocation);
  }
}

function assertUnreachable(_: never): never {
  throw new Error("Didn't expect to get here");
}
