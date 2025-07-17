import type { CompletionContext, CompletionExtraContexts } from "../contexts";
import type { CompletionResultItem } from "../solution";
import type { PostprocessFilter } from "./base";
import { limitScopeByIndentation } from "./limitScopeByIndentation";

export function limitScope(): PostprocessFilter {
  return async (
    item: CompletionResultItem,
    context: CompletionContext,
    extraContext: CompletionExtraContexts,
  ): Promise<CompletionResultItem> => {
    return limitScopeByIndentation()(item, context, extraContext);
  };
}
