import type { LanguageModelV2 } from "@ai-v5-sdk/provider";
import { EventSourceParserStream } from "@ai-v5-sdk/provider-utils";
import type { Store } from "@livestore/livestore";
import { events, tables } from "../../livestore/schema";
import { toTaskStatus } from "../../task";
import type { RequestData } from "../../types";
import type { LLMRequest, OnFinishCallback } from "./types";

export function createPochiModel(
  store: Store | undefined,
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
      const resp = await llm.apiClient.api.chatNext.stream.$post(
        {
          json: {
            id: taskId,
            model: llm.modelId,
            callOptions: {
              prompt,
              stopSequences,
              tools,
            },
          },
        },
        {
          init: {
            signal: abortSignal,
          },
        },
      );

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

  const taskId = payload.id;
  const onFinish: OnFinishCallback = async ({ messages }) => {
    if (!store || !taskId) return;

    const lastMessage = messages.at(-1);
    if (!lastMessage || lastMessage.metadata?.kind !== "assistant") {
      throw new Error("No messages to persist");
    }
    const parentTaskId = store.query(
      tables.tasks
        .select("parentId")
        .where("id", "=", taskId)
        .first({ fallback: () => null }),
    );
    const resp = await llm.apiClient.api.chatNext.persist.$post({
      json: {
        id: taskId,
        messages,
        environment: payload.environment,
        status: toTaskStatus(lastMessage, lastMessage.metadata),
        parentClientTaskId: parentTaskId ?? undefined,
      },
    });

    if (resp.status !== 200) {
      throw new Error(`Failed to persist chat: ${resp.statusText}`);
    }

    const { shareId } = (await resp.json()) as { shareId: string };
    const existingShareId = store.query(
      tables.tasks
        .select("shareId")
        .where("id", "=", taskId)
        .first({ fallback: () => null }),
    );
    if (!existingShareId) {
      store.commit(
        events.updateShareId({
          id: taskId,
          shareId,
          updatedAt: new Date(),
        }),
      );
    }
  };

  return {
    model,
    onFinish,
  };
}
