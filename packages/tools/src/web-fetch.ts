import { z } from "zod";
import { declareServerTool } from "./types";

export const webFetch = declareServerTool({
  description:
    "Fetches content from a specified URL with properly formatted response content.",
  inputSchema: z.object({
    url: z.string().describe("The URL to fetch content from"),
  }),
  outputSchema: z.object({
    result: z.string().describe("The AI model's response about the content"),
  }),
});
