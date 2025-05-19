import { ServerToolApproved, ServerTools } from "@ragdoll/tools";
import {
  type DataStreamWriter,
  type Message,
  type Tool,
  type ToolInvocation,
  formatDataStreamPart,
} from "ai";
import type { User } from "../../auth";
import { slackReplyThreadImpl } from "./slack-reply-thread";
import { webFetchImpl } from "./web-fetch";

const ServerToolsImpl: Record<string, (ctx: User) => Tool> = {
  slackReplyThread: slackReplyThreadImpl,
  webFetch: webFetchImpl,
};

const executeServerTools = async (ctx: User, toolCall: ToolInvocation) => {
  const makeToolFn = ServerToolsImpl[toolCall.toolName];
  if (!makeToolFn) {
    throw new Error(`Tool ${toolCall.toolName} not found`);
  }

  const toolFn = makeToolFn(ctx);
  if (!toolFn.execute) {
    throw new Error(`Tool ${toolCall.toolName} does not support execution`);
  }

  return await toolFn.execute(toolCall.args, {
    toolCallId: toolCall.toolCallId,
    messages: [],
    abortSignal: undefined,
  });
};

export async function resolveServerTools(
  messages: Message[],
  user: User,
  stream: DataStreamWriter,
) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return messages;
  lastMessage.parts = await Promise.all(
    lastMessage.parts?.map(async (part) => {
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.toolName in ServerTools &&
        part.toolInvocation.state === "result" &&
        part.toolInvocation.result === ServerToolApproved
      ) {
        const toolInvocation = part.toolInvocation;
        const result = await executeServerTools(user, toolInvocation);
        stream.write(
          formatDataStreamPart("tool_result", {
            toolCallId: toolInvocation.toolCallId,
            result,
          }),
        );

        return {
          ...part,
          toolInvocation: {
            ...toolInvocation,
            result,
          },
        };
      }

      return part;
    }) ?? [],
  );

  return messages;
}
