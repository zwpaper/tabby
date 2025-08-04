import { getLogger } from "@ragdoll/common";
import {
  type CodeAction,
  CodeActionKind,
  type InlineCompletionItem,
  Position,
  Range,
  type Uri,
  commands,
  workspace,
} from "vscode";

const logger = getLogger("CodeCompletion.auto-actions");

export function calcEditedRangeAfterAccept(
  item: InlineCompletionItem,
): Range | undefined {
  const range = item?.range;
  if (!range) {
    // FIXME: If the item has a null range, we can use current position and text length to calculate the result range
    return undefined;
  }
  if (!item) {
    return undefined;
  }
  const length = (item.insertText as string).split("\n").length - 1; //remove current line count;
  const completionRange = new Range(
    new Position(range.start.line, range.start.character),
    new Position(range.end.line + length + 1, 0),
  );
  logger.debug(
    "Calculate edited range for displayed completion item:",
    completionRange,
  );
  return completionRange;
}

export async function applyQuickFixes(uri: Uri, range: Range): Promise<void> {
  const codeActions = await commands.executeCommand<CodeAction[]>(
    "vscode.executeCodeActionProvider",
    uri,
    range,
  );
  const quickFixActions = codeActions.filter(
    (action) =>
      action.kind?.contains(CodeActionKind.QuickFix) &&
      action.title.toLowerCase().includes("import"),
  );

  if (quickFixActions.length === 1 && quickFixActions[0]) {
    const firstAction = quickFixActions[0];
    try {
      if (firstAction.edit) {
        await workspace.applyEdit(firstAction.edit);
      }
      if (firstAction.command) {
        await commands.executeCommand(
          firstAction.command.command,
          firstAction.command.arguments,
        );
      }
    } catch (error) {
      // ignore errors
    }
  }
}
