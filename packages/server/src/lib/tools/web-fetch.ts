import { defineServerTool } from "@ragdoll/tools";
import { z } from "zod";

const inputSchema = z.object({
  url: z.string().describe("The URL to fetch content from"),
});

const outputSchema = z.object({
  result: z.string().describe("The AI model's response about the content"),
});

export const webFetch = defineServerTool({
  description:
    "Fetches content from a specified URL with properly formatted response content.",
  inputSchema,
  outputSchema,
  makeExecuteFn: () => {
    return async ({ url }) => {
      try {
        if (!process.env.JINA_READER_API_KEY) {
          throw new Error(
            "JINA_READER_API_TOKEN environment variable is not set",
          );
        }

        const readerResponse = await fetch("https://r.jina.ai/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.JINA_READER_API_KEY}`,
          },
          body: JSON.stringify({
            url: url,
          }),
        });

        if (!readerResponse.ok) {
          throw new Error(
            `Jina Reader API error: ${readerResponse.status} ${readerResponse.statusText}`,
          );
        }
        const result = await readerResponse.text();
        return {
          result,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(`Error fetching or processing URL: ${errorMessage}`);
      }
    };
  },
});
