import type { Store } from "@livestore/livestore";
import type { RequestData } from "../../types";
import { createOpenAIModel } from "./openai";
import { createPochiModel } from "./pochi";
import { request } from "./request";
import type { LLMRequest } from "./types";

export function requestLLM(
  store: Store | undefined,
  taskId: string | undefined,
  llm: RequestData["llm"],
  payload: LLMRequest,
) {
  const { model, onFinish } = createModel(store, taskId, llm, payload);
  return request(model, payload, onFinish);
}

function createModel(
  store: Store | undefined,
  taskId: string | undefined,
  llm: RequestData["llm"],
  payload: LLMRequest,
) {
  if (llm.type === "openai") {
    return createOpenAIModel(llm);
  }

  if (llm.type === "pochi") {
    return createPochiModel(store, taskId, llm, payload);
  }

  throw new Error(`Unknown LLM type: ${llm}`);
}
