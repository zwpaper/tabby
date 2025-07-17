// Modified from: https://github.com/TabbyML/tabby/blob/493cef3b3229548175de430dbc7f7e4a092ca507/clients/tabby-agent/src/contextProviders/editorOptions.ts

import { injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
import { findTextEditor } from "../utils/find-text-editor";

export type EditorOptionsContext = {
  indentation: string;
};

@injectable()
@singleton()
export class EditorOptionsProvider {
  async getEditorOptions(
    uri: vscode.Uri,
    token?: vscode.CancellationToken | undefined,
  ): Promise<EditorOptionsContext | undefined> {
    if (token?.isCancellationRequested) {
      return undefined;
    }

    const editor = findTextEditor(uri);
    if (!editor) {
      return undefined;
    }

    const { insertSpaces, tabSize } = editor.options;

    let indentation: string | undefined;
    if (insertSpaces && typeof tabSize === "number" && tabSize > 0) {
      indentation = " ".repeat(tabSize);
    } else if (!insertSpaces) {
      indentation = "\t";
    }

    if (indentation === undefined) {
      return undefined;
    }

    return {
      indentation,
    };
  }
}
