// Modified from: https://github.com/TabbyML/tabby/blob/493cef3b3229548175de430dbc7f7e4a092ca507/clients/tabby-agent/src/codeCompletion/solution.ts

import type { CodeCompletionResponse } from "@ragdoll/server";
import * as vscode from "vscode";
import type { CompletionContext, CompletionExtraContexts } from "./contexts";
import { isBlank, splitLines } from "./utils/strings";

export class CompletionResultItem {
  // redundant quick access for text
  readonly lines: string[];
  readonly currentLine: string;

  constructor(
    readonly text: string,
    readonly eventId?: {
      completionId: string;
      choiceIndex: number;
    },
  ) {
    this.lines = splitLines(this.text);
    this.currentLine = this.lines[0] ?? "";
  }

  /**
   * Create a new CompletionResultItem from this item with the given text.
   * This method preserves the `eventId` property from the original item.
   * No other properties of the original item are carried over by design.
   */
  withText(text: string): CompletionResultItem {
    return new CompletionResultItem(text, this.eventId);
  }

  toCompletionItem(
    context: CompletionContext,
  ): vscode.CompletionItem | undefined {
    if (isBlank(this.text)) {
      return undefined;
    }

    const document = context.document;
    const position = context.position;
    const linePrefix = document.getText(
      new vscode.Range(new vscode.Position(position.line, 0), position),
    );
    const wordPrefix = linePrefix.match(/(\w+)$/)?.[0] ?? "";
    const insertText = context.selectedCompletionInsertion + this.text;

    const insertLines = splitLines(insertText);
    const firstLine = insertLines[0] || "";
    const secondLine = insertLines[1] || "";
    return {
      label: {
        label: wordPrefix + firstLine,
        detail: secondLine,
        description: "Tabby",
      },
      kind: vscode.CompletionItemKind.Text,
      documentation: new vscode.MarkdownString(
        `\`\`\`\n${linePrefix + insertText}\n\`\`\`\n ---\nSuggested by Tabby.`,
      ),
      textEdit: {
        newText: wordPrefix + insertText,
        range: new vscode.Range(
          position.line,
          position.character - wordPrefix.length,
          position.line,
          position.character + context.lineEndReplaceLength,
        ),
      },
    };
  }

  toInlineCompletionItem(
    context: CompletionContext,
  ): vscode.InlineCompletionItem | undefined {
    if (isBlank(this.text)) {
      return undefined;
    }

    const position = context.position;
    const insertText = context.selectedCompletionInsertion + this.text;
    return {
      insertText,
      range: new vscode.Range(
        position,
        new vscode.Position(
          position.line,
          position.character + context.lineEndReplaceLength,
        ),
      ),
    };
  }
}

export class CompletionSolution {
  extraContext: CompletionExtraContexts = {};
  isCompleted = false;
  items: CompletionResultItem[] = [];

  toCompletionList(context: CompletionContext): vscode.CompletionList {
    return {
      isIncomplete: !this.isCompleted,
      items: this.items
        .map((item) => item.toCompletionItem(context))
        .filter((item): item is vscode.CompletionItem => item !== undefined),
    };
  }

  toInlineCompletionList(
    context: CompletionContext,
  ): vscode.InlineCompletionList {
    return {
      items: this.items
        .map((item) => item.toInlineCompletionItem(context))
        .filter(
          (item): item is vscode.InlineCompletionItem => item !== undefined,
        ),
    };
  }
}

export const emptyCompletionResultItem = new CompletionResultItem("");

export function createCompletionResultItemFromResponse(
  response: CodeCompletionResponse,
): CompletionResultItem {
  const index = 0; // api always returns 0 or 1 choice
  return new CompletionResultItem(response.choices[index]?.text ?? "", {
    completionId: response.id,
    choiceIndex: response.choices[index]?.index ?? index,
  });
}
