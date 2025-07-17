import { getLogger } from "@/lib/logger";
import type { CodeCompletionConfig } from "../configuration";
import type { CompletionContext, CompletionExtraContexts } from "../contexts";
import type { CompletionResultItem } from "../solution";

export type PostprocessFilterFactory =
  | (() => PostprocessFilter)
  | ((config: PostprocessConfig) => PostprocessFilter);

export type PostprocessConfig =
  (typeof CodeCompletionConfig)["value"]["postprocess"];

export type PostprocessFilter = (
  input: CompletionResultItem,
  context: CompletionContext,
  extraContext: CompletionExtraContexts,
) => CompletionResultItem | Promise<CompletionResultItem>;

export const logger = getLogger("CodeCompletion.PostProcess");
