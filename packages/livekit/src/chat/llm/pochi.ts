import type { LanguageModelV2 } from "@ai-v5-sdk/provider";
import { EventSourceParserStream } from "@ai-v5-sdk/provider-utils";
import type { RequestData } from "../../types";
import type { LLMRequest, OnFinishCallback } from "./types";

export function createPochiModel(
  taskId: string | undefined,
  llm: Extract<RequestData["llm"], { type: "pochi" }>,
  payload: LLMRequest,
) {
  const model: LanguageModelV2 = {
    specificationVersion: "v2",
    provider: "Pochi",
    modelId: llm.modelId || "<default>",
    // FIXME(meng): fill supported urls based on modelId.
    supportedUrls: {},
    doGenerate: async () => Promise.reject("Not implemented"),
    doStream: async ({ prompt, abortSignal, stopSequences, tools }) => {
      const resp = await fetch(`${llm.server}/api/chatNext/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llm.token}`,
        },
        signal: abortSignal,
        body: JSON.stringify({
          id: taskId,
          model: llm.modelId,
          callOptions: {
            prompt,
            stopSequences,
            tools,
          },
          persistOptions: {
            messages: payload.messages,
            environment: payload.environment,
          },
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

  const onFinish: OnFinishCallback = async ({ messages }) => {
    const resp = await fetch(`${llm.server}/api/chatNext/persist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.token}`,
      },
      body: JSON.stringify({
        id: taskId,
        messages,
        environment: payload.environment,
      }),
    });

    if (resp.status !== 200) {
      throw new Error(`Failed to persist chat: ${resp.statusText}`);
    }
  };

  return {
    model,
    onFinish,
  };
}
