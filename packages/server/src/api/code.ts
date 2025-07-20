import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../auth";

import { codeCompletionService } from "../service/code-completion";
import { ZodCodeCompletionRequestType } from "../types";

const code = new Hono()
  .use(requireAuth())
  .post(
    "/completion",
    zValidator("json", ZodCodeCompletionRequestType),
    async (c) => {
      const req = c.req.valid("json");

      // Validate required segments
      if (!req.segments || !req.segments.prefix) {
        throw new HTTPException(400, {
          message: "Request must include segments with at least a prefix",
        });
      }

      // Check user permissions

      try {
        const response = await codeCompletionService.generateCompletion(
          req,
          c.req.raw.signal,
        );
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
        }

        // Generic error
        throw error;
      }
    },
  );

export default code;
