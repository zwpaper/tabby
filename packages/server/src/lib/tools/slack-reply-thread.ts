import { defineServerTool } from "@ragdoll/tools";
import { z } from "zod";
import type { User } from "../../auth";
import slack from "../../slack";

// Define the input schema for the slackReplyThread tool
const inputSchema = z.object({
  integrationId: z
    .string()
    .describe("The ID of the Slack team or organization (enterprise)."),
  channel: z
    .string()
    .describe("The ID of the Slack channel containing the thread."),
  threadTs: z
    .string()
    .describe("The timestamp of the parent message of the thread."),
  text: z.string().describe("The content to post in the thread."),
});

// Define the output schema for the slackReplyThread tool
const outputSchema = z.object({
  ts: z
    .string()
    .optional()
    .describe("The timestamp of the posted reply message."),
});

// Define the slackReplyThread tool using defineServerTool
export const slackReplyThread = defineServerTool({
  description: "Replies to a specific thread in a Slack channel.",
  inputSchema,
  outputSchema,
  makeExecuteFn: (user: User) => {
    return async ({ integrationId, channel, threadTs, text }) => {
      const client = await slack.getWebClient(user.id, integrationId);
      const result = await client.chat.postMessage({
        thread_ts: threadTs,
        channel,
        text,
      });
      if (result.ts) {
        return {
          ts: result.ts,
        };
      }
      throw new Error(result.error);
    };
  },
});
