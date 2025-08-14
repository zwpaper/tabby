import type { RequestData } from "../../types";
import { createOpenAIModel } from "./openai";
import { createPochiModel } from "./pochi";
import { request } from "./request";
import type { LLMRequest } from "./types";

export function requestLLM(
  taskId: string | undefined,
  llm: RequestData["llm"],
  payload: LLMRequest,
) {
  const { model, onFinish } = createModel(taskId, llm, payload);
  return request(model, payload, onFinish);
}

function createModel(
  taskId: string | undefined,
  llm: RequestData["llm"],
  payload: LLMRequest,
) {
  if (llm.type === "openai") {
    return createOpenAIModel(llm);
  }

  if (llm.type === "pochi") {
    return createPochiModel(taskId, llm, payload);
  }

  throw new Error(`Unknown LLM type: ${llm}`);
}
