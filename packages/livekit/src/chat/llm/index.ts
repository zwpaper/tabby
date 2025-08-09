import type { RequestData } from "../../types";
import { requestOpenAI } from "./openai";
import { requestPochi } from "./pochi";
import type { LLMRequest } from "./types";

export function requestLLM(llm: RequestData["llm"], payload: LLMRequest) {
  if (llm.type === "openai") {
    return requestOpenAI(llm, payload);
  }

  if (llm.type === "pochi") {
    return requestPochi(llm, payload);
  }

  throw new Error(`Unknown LLM type: ${llm}`);
}
