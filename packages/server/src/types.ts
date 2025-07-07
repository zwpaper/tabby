import type { DBMessage, TaskCreateEvent } from "@ragdoll/db";
import { ZodEnvironment } from "@ragdoll/db";
import { ZodMcpToolType } from "@ragdoll/tools";
import { z } from "zod";

export const ZodMessageType: z.ZodType<DBMessage> = z.any();
const ZodEventType: z.ZodType<TaskCreateEvent> = z.any();

export const ZodChatRequestType = z.object({
  id: z.string().optional().describe("Task uid."),
  sessionId: z.string().describe("Session uid, used to lock the task."),
  model: z.string().optional().describe("Model to use for this request."),
  event: ZodEventType.optional().describe("Associated event for the task."),
  message: ZodMessageType.describe("Message payload for the chat request."),
  mcpToolSet: z
    .record(
      z.string().describe("Name of the MCP tool."),
      ZodMcpToolType.describe("Definition of the MCP tool."),
    )
    .optional()
    .describe("MCP tools available for this request."),
  environment: ZodEnvironment.optional().describe(
    "Execution environment settings.",
  ),
  minionId: z
    .string()
    .optional()
    .describe("The ID of the minion (remote Pochi)."),
});

export type ChatRequest = z.infer<typeof ZodChatRequestType>;

// Code Completion API types (Fill-in-Middle style completion)
export const ZodCodeCompletionRequestType = z.object({
  language: z.string().optional().describe("Programming language identifier"),
  segments: z
    .object({
      prefix: z.string().describe("Code before cursor"),
      suffix: z.string().optional().describe("Code after cursor"),
      filepath: z.string().optional().describe("Relative file path"),
      git_url: z.string().optional().describe("Git repository URL"),
      declarations: z
        .array(
          z.object({
            filepath: z.string().describe("File path (relative or URI)"),
            body: z.string().describe("Declaration code"),
          }),
        )
        .optional()
        .describe("LSP-provided declarations"),
      relevant_snippets_from_changed_files: z
        .array(
          z.object({
            filepath: z.string().describe("File path"),
            body: z.string().describe("Code snippet"),
            score: z.number().optional().describe("Relevance score"),
          }),
        )
        .optional()
        .describe("Recent edit context"),
      relevant_snippets_from_recently_opened_files: z
        .array(
          z.object({
            filepath: z.string().describe("File path"),
            body: z.string().describe("Code snippet"),
            score: z.number().optional().describe("Relevance score"),
          }),
        )
        .optional()
        .describe("Recent file context"),
      clipboard: z.string().optional().describe("Clipboard content"),
    })
    .describe("Code completion segments"),
  temperature: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Model temperature (0.0-1.0)"),
  mode: z
    .enum(["standard", "next_edit_suggestion"])
    .optional()
    .describe("Completion mode"),
});

export const ZodCodeCompletionResponseType = z.object({
  id: z.string().describe("Completion ID"),
  choices: z
    .array(
      z.object({
        index: z.number().describe("Choice index"),
        text: z.string().describe("Generated completion text"),
      }),
    )
    .describe("Completion choices"),
});

export type CodeCompletionRequest = z.infer<
  typeof ZodCodeCompletionRequestType
>;
export type CodeCompletionResponse = z.infer<
  typeof ZodCodeCompletionResponseType
>;
