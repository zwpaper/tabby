import { z } from "zod";
import { declareServerTool } from "./types";

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
export const slackReplyThread = declareServerTool({
  description: "Replies to a specific thread in a Slack channel.",
  inputSchema,
  outputSchema,
});
