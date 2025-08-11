import type { LanguageModelV2 } from "@ai-v5-sdk/provider";
import { EventSourceParserStream } from "@ai-v5-sdk/provider-utils";
import type { RequestData } from "../../types";

export function createPochiModel(
  llm: Extract<RequestData["llm"], { type: "pochi" }>,
  taskId?: string,
): LanguageModelV2 {
  return {
    specificationVersion: "v2",
    provider: "Pochi",
    modelId: llm.modelId || "<default>",
    // FIXME(meng): fill supported urls based on modelId.
    supportedUrls: {},
    doGenerate: async () => Promise.reject("Not implemented"),
    doStream: async ({ prompt, abortSignal, stopSequences }) => {
      const resp = await fetch(`${llm.server}/api/chatNext/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llm.token}`,
        },
        signal: abortSignal,
        body: JSON.stringify({
          id: taskId,
          prompt,
          model: llm.modelId,
          stopSequences,
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
      }

      const stream = resp.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .pipeThrough(
          new TransformStream({
            async transform({ data }, controller) {
              if (data === "[DONE]") {
                return;
              }
              controller.enqueue(JSON.parse(data));
            },
          }),
        );
      return { stream };
    },
  };
}
