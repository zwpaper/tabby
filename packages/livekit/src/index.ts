import { binary_to_base58 } from "base58-js";
import type { RequestData } from "./types";

export * as catalog from "./livestore";
export type LLMRequestData = RequestData["llm"];
export type { Message, Task, UITools } from "./types";

export function getStoreId(cwd: string) {
  return binary_to_base58(new TextEncoder().encode(cwd));
}
