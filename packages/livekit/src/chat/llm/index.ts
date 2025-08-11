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
  const model = createModel(taskId, llm);
  return request(model, payload);
}

function createModel(taskId: string | undefined, llm: RequestData["llm"]) {
  if (llm.type === "openai") {
    return createOpenAIModel(llm);
  }

  if (llm.type === "pochi") {
    return createPochiModel(taskId, llm);
  }

  throw new Error(`Unknown LLM type: ${llm}`);
}
