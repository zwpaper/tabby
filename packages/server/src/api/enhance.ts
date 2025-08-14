import { APICallError, RetryError, generateText } from "@ai-v5-sdk/ai";
import { zValidator } from "@hono/zod-validator";
import { getLogger } from "@ragdoll/common";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "../auth";

import { geminiFlashNext } from "../lib/constants";

const logger = getLogger("EnhanceApi");

const EnhancePromptSchema = z.object({
  prompt: z.string().min(8),
});

const enhance = new Hono().post(
  "/",
  zValidator("json", EnhancePromptSchema),
  requireAuth(),
  async (c) => {
    const { prompt } = await c.req.valid("json");

    try {
      const result = await generateText({
        model: geminiFlashNext,
        system:
          "Enhance the user's prompt to make it clearer and more specific while maintaining its original intent. Make it concise and straightforward. Do NOT use markdown formatting, bullet points, or numbered lists. Avoid creating complex structured templates. Keep the enhancement natural, conversational, and directly usable as text input. Return only the enhanced prompt without any explanations, comments, headings, or special formatting.",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const enhancedPrompt = await result.text;

      return c.json({
        original: prompt,
        enhanced: enhancedPrompt.trim(),
      });
    } catch (error) {
      logger.error("Error enhancing prompt", error);

      if (RetryError.isInstance(error)) {
        if (APICallError.isInstance(error.lastError)) {
          if (error.lastError.statusCode === 429) {
            throw new HTTPException(429, {
              message: "Too many requests. Please try again later.",
            });
          }
        }
      }

      throw new HTTPException(500, {
        message: "Failed to enhance prompt",
      });
    }
  },
);

export default enhance;
