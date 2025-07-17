import type { CompletionContext } from "../contexts";
import type { CompletionResultItem } from "../solution";
import { isBlank } from "../utils/strings";
import type { PostprocessFilter } from "./base";

export function trimSpace(): PostprocessFilter {
  return (
    item: CompletionResultItem,
    context: CompletionContext,
  ): CompletionResultItem => {
    const { currentLinePrefix, currentLineSuffix } = context;
    let trimmedInput = item.text;

    if (!isBlank(currentLinePrefix) && currentLinePrefix.match(/\s$/)) {
      trimmedInput = trimmedInput.trimStart();
    }
    if (
      isBlank(currentLineSuffix) ||
      (!isBlank(currentLineSuffix) && currentLineSuffix.match(/^\s/))
    ) {
      trimmedInput = trimmedInput.trimEnd();
    }
    if (trimmedInput !== item.text) {
      return item.withText(trimmedInput);
    }
    return item;
  };
}
