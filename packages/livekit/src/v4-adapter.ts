/**
 * Helpers to convert v4 messages to v5 messages
 */

import { type Tool, asSchema, getToolName, isToolUIPart } from "@ai-v5-sdk/ai";
import { ClientTools } from "@getpochi/tools";
import type { DBMessage } from "@ragdoll/db";
import type { UIMessage as V4UIMessage } from "ai";
import type { Message } from "./types";

export function fromDBMessage(x: DBMessage): Message {
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
          const toolName = toolInvocation.toolName as keyof typeof ClientTools;
          const toolPart = createToolPart(
            toolInvocation,
            ClientTools[toolName] || null,
          );
          parts.push(toolPart);
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
      case "dynamic-tool":
      case "source-url":
        throw new Error("Unsupported part type");
      default:
        if (isToolUIPart(part)) {
          const toolName = getToolName(part);
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

function createToolPart(
  toolInvocation: Extract<
    DBMessage["parts"][number],
    { type: "tool-invocation" }
  >["toolInvocation"],
  tool: Tool | null,
): Message["parts"][number] {
  const schema = tool && asSchema(tool.inputSchema);
  if (schema?.validate) {
    const result = schema.validate(toolInvocation.args);
    if (!("then" in result) && !result.success) {
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
      const schema = tool && asSchema(tool.outputSchema);
      if (schema?.validate) {
        const result = schema.validate(toolInvocation.result);
        if (!("then" in result) && !result.success) {
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

function assertUnreachable(_: never): never {
  throw new Error("Didn't expect to get here");
}

export function toV4UIMessage(message: Message): V4UIMessage {
  return toUIMessage(toDBMessage(message));
}

export function fromV4UIMessage(message: V4UIMessage): Message {
  return fromDBMessage(fromUIMessage(message));
}

export function fromV4DBMessage(message: DBMessage): Message {
  return fromDBMessage(message);
}

function fromUIMessage(message: V4UIMessage): DBMessage {
  const parts = (message.parts || []).filter((x) => x.type !== "source");
  return {
    ...message,
    parts,
  };
}

function toUIMessage(message: DBMessage): V4UIMessage {
  return {
    // Force conversion to UIMessage
    ...(message as V4UIMessage),
    content: "",
    createdAt: undefined,
  };
}
