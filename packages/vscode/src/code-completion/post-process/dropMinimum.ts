import {
  type CompletionResultItem,
  emptyCompletionResultItem,
} from "../solution";
import type { PostprocessConfig, PostprocessFilter } from "./base";

export function dropMinimum(config: PostprocessConfig): PostprocessFilter {
  return (item: CompletionResultItem): CompletionResultItem => {
    if (item.text.trim().length < config.minCompletionChars) {
      return emptyCompletionResultItem;
    }
    return item;
  };
}
