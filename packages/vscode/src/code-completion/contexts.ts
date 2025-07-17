// Modified from: https://github.com/TabbyML/tabby/blob/493cef3b3229548175de430dbc7f7e4a092ca507/clients/tabby-agent/src/codeCompletion/contexts.ts

import { getLogger } from "@/lib/logger";
import * as vscode from "vscode";
import type {
  CodeSearchResult,
  EditorOptionsContext,
  GitContext,
  TextDocumentRangeContext,
  WorkspaceContext,
} from "./context-provider";
import { StaticTextDocument } from "./utils/static-text-document";
import { splitLines } from "./utils/strings";

const logger = getLogger("CodeCompletion.Context");

export interface CompletionContext {
  readonly document: vscode.TextDocument;
  readonly position: vscode.Position;
  readonly selectedCompletionInfo?: vscode.SelectedCompletionInfo;
  readonly notebookCells?: vscode.TextDocument[];

  // calculated from selectedCompletionInfo, this insertion text is already included in prefix
  readonly selectedCompletionInsertion: string;

  // the line suffix is empty or should be replaced, in this case, the line suffix is already excluded from suffix
  readonly isLineEnd: boolean;
  readonly lineEndReplaceLength: number;

  // calculated from contexts, do not equal to document prefix and suffix
  readonly prefix: string;
  readonly suffix: string;

  // redundant quick access for prefix and suffix
  readonly prefixLines: string[];
  readonly suffixLines: string[];
  readonly currentLinePrefix: string;
  readonly currentLineSuffix: string;
}

export function buildCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  selectedCompletionInfo?: vscode.SelectedCompletionInfo,
  notebookCells?: vscode.TextDocument[],
): CompletionContext {
  let selectedCompletionInsertion = "";
  if (selectedCompletionInfo) {
    // Handle selected completion info only if replacement matches prefix
    // Handle: con -> console
    // Ignore: cns -> console
    const replaceRange = selectedCompletionInfo.range;
    if (
      replaceRange.start.line === position.line &&
      replaceRange.start.isBefore(position) &&
      replaceRange.end.isEqual(position)
    ) {
      const replaceLength =
        replaceRange.end.character - replaceRange.start.character;
      selectedCompletionInsertion =
        selectedCompletionInfo.text.substring(replaceLength);
      logger.trace("Used selected completion insertion: ", {
        selectedCompletionInsertion,
      });
    }
  }

  let notebookCellsPrefix = "";
  let notebookCellsSuffix = "";
  if (notebookCells) {
    const currentCellIndex = notebookCells.indexOf(document);
    if (currentCellIndex >= 0 && currentCellIndex < notebookCells.length - 1) {
      const currentLanguageId = document.languageId;
      const formatContext = (cells: vscode.TextDocument[]): string => {
        const notebookLanguageComments: {
          [languageId: string]: (code: string) => string;
        } = {
          // biome-ignore lint/style/useTemplate: <explanation>
          markdown: (code) => "```\n" + code + "\n```",
          python: (code) =>
            code
              .split("\n")
              .map((l) => `# ${l}`)
              .join("\n"),
        };
        return cells
          .map((textDocument) => {
            if (textDocument.languageId === currentLanguageId) {
              return textDocument.getText();
            }
            if (
              Object.keys(notebookLanguageComments).includes(currentLanguageId)
            ) {
              return (
                notebookLanguageComments[currentLanguageId]?.(
                  textDocument.getText(),
                ) ?? ""
              );
            }
            return "";
          })
          .join("\n\n");
      };
      notebookCellsPrefix = `${formatContext(notebookCells.slice(0, currentCellIndex))}\n\n`;
      notebookCellsSuffix = `\n\n${formatContext(notebookCells.slice(currentCellIndex + 1))}`;
      logger.trace("Used notebook cells context:", {
        notebookCellsPrefix,
        notebookCellsSuffix,
      });
    }
  }

  const fullDocumentRange = new vscode.Range(0, 0, document.lineCount, 0);
  const prefixRange = new vscode.Range(fullDocumentRange.start, position);
  const documentPrefix = document.getText(prefixRange);
  const prefix =
    notebookCellsPrefix + documentPrefix + selectedCompletionInsertion;

  const documentCurrentLineSuffixRange = document.validateRange(
    new vscode.Range(position.line, position.character, position.line + 1, 0),
  );
  const documentCurrentLineSuffix = documentCurrentLineSuffixRange.isEmpty
    ? ""
    : document.getText(documentCurrentLineSuffixRange);
  const isLineEnd = !!documentCurrentLineSuffix.match(/^\W*$/);
  const lineEndReplaceLength = isLineEnd
    ? documentCurrentLineSuffix.replace(/\r?\n$/, "").length
    : 0;

  const suffixRange = document.validateRange(
    new vscode.Range(
      new vscode.Position(
        position.line,
        position.character + lineEndReplaceLength,
      ),
      fullDocumentRange.end,
    ),
  );
  const documentSuffix = suffixRange.isEmpty
    ? ""
    : document.getText(suffixRange);

  const suffix = documentSuffix + notebookCellsSuffix;

  const prefixLines = splitLines(prefix);
  const suffixLines = splitLines(suffix);
  const currentLinePrefix = prefixLines[prefixLines.length - 1] ?? "";
  const currentLineSuffix = suffixLines[0] ?? "";

  return {
    document,
    position,
    selectedCompletionInfo,
    notebookCells,
    selectedCompletionInsertion,
    isLineEnd,
    lineEndReplaceLength,
    prefix,
    suffix,
    prefixLines,
    suffixLines,
    currentLinePrefix,
    currentLineSuffix,
  };
}

export function buildCompletionContextWithAppend(
  context: CompletionContext,
  appendText: string,
): CompletionContext {
  const offset = context.document.offsetAt(context.position);
  const updatedText = context.prefix + appendText + context.suffix;
  const updatedOffset = offset + appendText.length;
  const updatedDocument = new StaticTextDocument(
    context.document.uri,
    context.document.languageId,
    context.document.version + 1,
    updatedText,
  );
  const updatedPosition = updatedDocument.positionAt(updatedOffset);
  return buildCompletionContext(
    updatedDocument,
    updatedPosition,
    undefined,
    context.notebookCells,
  );
}

export interface CompletionExtraContexts {
  workspace?: WorkspaceContext;
  git?: GitContext;
  declarations?: TextDocumentRangeContext[];
  recentlyChangedCodeSearchResult?: CodeSearchResult;
  lastViewedSnippets?: TextDocumentRangeContext[];
  editorOptions?: EditorOptionsContext;
}
