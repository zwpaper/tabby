import { ServerTools, defineServerTool } from "@ragdoll/tools";

export const webFetchImpl = defineServerTool({
  tool: ServerTools.webFetch,
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
        let result = await readerResponse.text();

        // Check if content is greater than 256K
        const MaxLength = 256 * 1024;
        let isTruncated = false;
        if (Buffer.byteLength(result, "utf-8") > MaxLength) {
          result = result.slice(0, MaxLength);
          isTruncated = true;
        }

        return {
          result,
          isTruncated,
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(`Error fetching or processing URL: ${errorMessage}`);
      }
    };
  },
});
