import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../auth";

import {
  CodeCompletionRequest,
  type CodeCompletionResponse,
} from "@ragdoll/common/pochi-api";
import { checkUserCodeCompletionQuota } from "../lib/check-request";
import { codeCompletionService } from "../service/code-completion";
import { usageService } from "../service/usage";

const code = new Hono()
  .use(requireAuth())
  .post("/completion", zValidator("json", CodeCompletionRequest), async (c) => {
    const req = c.req.valid("json");

    // Check user subscription
    const user = c.get("user");
    await checkUserCodeCompletionQuota(user);

    try {
      const response: CodeCompletionResponse =
        await codeCompletionService.generateCompletion(req, c.req.raw.signal);

      // Track usage
      await usageService.trackCodeCompletionUsage(user);

      return c.json(response);
    } catch (error) {
      // Handle specific error types
      if (error instanceof HTTPException) {
        throw error;
      }

      // Handle Mistral API errors
      if (error instanceof Error) {
        if (error.message.includes("MISTRAL_API_KEY")) {
          throw new HTTPException(500, {
            message: "Code completion service not configured properly.",
          });
        }

        if (error.message.includes("Mistral API error")) {
          throw new HTTPException(503, {
            message:
              "Code completion service temporarily unavailable. Please try again.",
          });
        }

        if (error.message.includes("fetch")) {
          throw new HTTPException(503, {
            message: "Network error accessing completion service.",
          });
        }

        if (error.message.includes("The connection was closed")) {
          // @ts-expect-error 499 is a non-standard status code for client closed request
          // https://http.dev/499
          throw new HTTPException(499, {
            message: "Client closed the connection.",
          });
        }
      }

      // Generic error
      throw error;
    }
  });

export default code;
