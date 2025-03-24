import { z } from "zod";
import {
  type ToolFunctionType,
  type ToolInputType,
  type ToolOutputType,
  declareClientTool,
} from "./types";

export const askFollowupQuestion = declareClientTool({
  description:
    "Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively.",
  inputSchema: z.object({
    question: z.string().describe("The question to ask the user."),
    followUp: z
      .array(z.string())
      .describe(
        "A list of 2-4 suggested answers that logically follow from the question.",
      ),
  }),
  outputSchema: z.object({
    answer: z.string().describe("The user's answer to the question."),
  })
});

export type AskFollowupQuestionInputType = ToolInputType<
  typeof askFollowupQuestion
>;
export type AskFollowupQuestionOutputType = ToolOutputType<
  typeof askFollowupQuestion
>;

export type AskFollowupQuestionFunctionType = ToolFunctionType<
  typeof askFollowupQuestion
>;
