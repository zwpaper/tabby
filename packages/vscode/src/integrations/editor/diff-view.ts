import * as path from "node:path";
import {
  diagnosticsToProblemsString,
  getNewDiagnostics,
} from "@/lib/diagnostic";
import {
  ensureFileDirectoryExists,
  getWorkspaceFolder,
  isFileExists,
} from "@/lib/fs";
import { createPrettyPatch } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import * as runExclusive from "run-exclusive";
import * as vscode from "vscode";
import { DecorationController } from "./decoration-controller";
import { DiffOriginContentProvider } from "./diff-origin-content-provider";

const logger = getLogger("diffView");
const ShouldAutoScroll = true;
const ReuseDiffView = true;

export class DiffView implements vscode.Disposable {
  private isFinalized = false;
  private streamedLines: string[] = [];

  private preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] =
    vscode.languages.getDiagnostics();
  private fadedOverlayController: DecorationController;
  private activeLineController: DecorationController;
  private editorDocumentUpdatedAt: number | undefined;

  private disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly fileUri: vscode.Uri,
    private readonly fileExists: boolean,
    private readonly activeDiffEditor: vscode.TextEditor,
  ) {
    this.fadedOverlayController = new DecorationController(
      "fadedOverlay",
      this.activeDiffEditor,
    );
    this.activeLineController = new DecorationController(
      "activeLine",
      this.activeDiffEditor,
    );
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(
        ({ document, contentChanges }) => {
          if (
            document.uri.toString() ===
              this.activeDiffEditor.document.uri.toString() &&
            contentChanges.length > 0
          ) {
            this.editorDocumentUpdatedAt = Date.now();
          }
        },
      ),
    );
  }

  dispose() {
    if (!this.fileExists) {
      // Delete file if file is empty
      (async () => {
        const metadata = await vscode.workspace.fs.stat(this.fileUri);
        if (metadata.size === 0) {
          await vscode.workspace.fs.delete(this.fileUri);
        }
      })().catch((err) => {
        logger.debug("Error deleting file", err);
      });
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  async update(content: string, isFinal: boolean) {
    if (this.isFinalized) {
      logger.debug(
        "File is already finalized, skipping update",
        this.fileUri.fsPath,
      );
      return;
    }

    if (isFinal) {
      logger.debug("Finalizing file", this.fileUri.fsPath);
      this.isFinalized = true;
    }

    let accumulatedContent = content;
    // --- Fix to prevent duplicate BOM ---
    // Strip potential BOM from incoming content. VS Code's `applyEdit` might implicitly handle the BOM
    // when replacing from the start (0,0), and we want to avoid duplication.
    // Final BOM is handled in `saveChanges`.
    if (accumulatedContent.startsWith("\ufeff")) {
      accumulatedContent = content.slice(1); // Remove the BOM character
    }

    const diffEditor = this.activeDiffEditor;
    const document = diffEditor.document;

    const accumulatedLines = accumulatedContent.split("\n");
    if (!isFinal) {
      accumulatedLines.pop(); // remove the last partial line only if it's not the final update
    }
    const diffLines = accumulatedLines.slice(this.streamedLines.length);

    // Instead of animating each line, we'll update in larger chunks
    const currentLine = this.streamedLines.length + diffLines.length - 1;
    if (currentLine >= 0) {
      // Only proceed if we have new lines

      // Replace all content up to the current line with accumulated lines
      // This is necessary (as compared to inserting one line at a time) to handle cases where html tags on previous lines are auto closed for example
      const edit = new vscode.WorkspaceEdit();
      const rangeToReplace = new vscode.Range(0, 0, currentLine + 1, 0);
      const contentToReplace = `${accumulatedLines.slice(0, currentLine + 1).join("\n")}\n`;
      edit.replace(document.uri, rangeToReplace, contentToReplace);
      await vscode.workspace.applyEdit(edit);

      // Update decorations for the entire changed section
      this.activeLineController.setActiveLine(currentLine);
      this.fadedOverlayController.updateOverlayAfterLine(
        currentLine,
        document.lineCount,
      );

      if (ShouldAutoScroll) {
        if (diffLines.length <= 5) {
          // For small changes, just jump directly to the line
          this.scrollEditorToLine(currentLine);
        } else {
          // For larger changes, create a quick scrolling animation
          const startLine = this.streamedLines.length;
          const endLine = currentLine;
          const totalLines = endLine - startLine;
          const numSteps = 10; // Adjust this number to control animation speed
          const stepSize = Math.max(1, Math.floor(totalLines / numSteps));

          // Create and await the smooth scrolling animation
          for (let line = startLine; line <= endLine; line += stepSize) {
            diffEditor.revealRange(
              new vscode.Range(line, 0, line, 0),
              vscode.TextEditorRevealType.InCenter,
            );
            await new Promise((resolve) => setTimeout(resolve, 16)); // ~60fps
          }
          // Ensure we end at the final line
          this.scrollEditorToLine(currentLine);
        }
      }
    }

    // Update the streamedLines with the new accumulated content
    this.streamedLines = accumulatedLines;
    if (isFinal) {
      // Handle any remaining lines if the new content is shorter than the original
      if (this.streamedLines.length < document.lineCount) {
        const edit = new vscode.WorkspaceEdit();
        edit.delete(
          document.uri,
          new vscode.Range(this.streamedLines.length, 0, document.lineCount, 0),
        );
        await vscode.workspace.applyEdit(edit);
      }
      this.fadedOverlayController.clear();
      this.activeLineController.clear();
    }
  }

  async saveChanges(relPath: string, newContent: string) {
    const updatedDocument = this.activeDiffEditor.document;
    const preSaveContent = updatedDocument.getText();
    if (updatedDocument.isDirty) {
      await updatedDocument.save();
    }
    const postSaveContent = updatedDocument.getText();

    const document = await vscode.workspace.openTextDocument(this.fileUri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false,
    });
    await closeAllNonDirtyDiffViews();

    await this.waitForDiagnostic();
    const postDiagnostics = vscode.languages.getDiagnostics();
    const newProblems = diagnosticsToProblemsString(
      getNewDiagnostics(this.preDiagnostics, postDiagnostics),
      [
        vscode.DiagnosticSeverity.Error, // only including errors since warnings can be distracting (if user wants to fix warnings they can use the @problems mention)
      ],
      getWorkspaceFolder()?.uri.fsPath,
    ); // will be empty string if no errors

    const newContentEOL = newContent.includes("\r\n") ? "\r\n" : "\n";
    const normalizedPreSaveContent =
      preSaveContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() +
      newContentEOL; // trimEnd to fix issue where editor adds in extra new line automatically
    const normalizedPostSaveContent =
      postSaveContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() +
      newContentEOL; // this is the final content we return to the model to use as the new baseline for future edits
    const normalizedNewContent =
      newContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL;

    let userEdits: string | undefined;
    if (normalizedPreSaveContent !== normalizedNewContent) {
      // user made changes before approving edit. let the model know about user made changes (not including post-save auto-formatting changes)
      userEdits = createPrettyPatch(
        relPath,
        normalizedNewContent,
        normalizedPreSaveContent,
      );
    }

    let autoFormattingEdits: string | undefined;
    if (normalizedPreSaveContent !== normalizedPostSaveContent) {
      // auto-formatting was done by the editor
      autoFormattingEdits = createPrettyPatch(
        relPath,
        normalizedPreSaveContent,
        normalizedPostSaveContent,
      );
    }

    return {
      userEdits,
      autoFormattingEdits,
      newProblems,
    };
  }

  private async waitForDiagnostic() {
    if (process.env.VSCODE_TEST_OPTIONS) {
      // No waiting in test mode
      return;
    }

    const waitForDiagnosticMs = 1000;
    const timeoutDuration =
      this.editorDocumentUpdatedAt !== undefined
        ? Math.max(
            1,
            Math.min(
              waitForDiagnosticMs,
              this.editorDocumentUpdatedAt + waitForDiagnosticMs - Date.now(),
            ),
          )
        : waitForDiagnosticMs;
    logger.debug(`Waiting ${timeoutDuration}ms for diagnostics to update...`);
    await new Promise((resolve) => {
      setTimeout(resolve, timeoutDuration);
    });
  }

  private scrollEditorToLine(line: number) {
    const scrollLine = line + 4;
    this.activeDiffEditor.revealRange(
      new vscode.Range(scrollLine, 0, scrollLine, 0),
      vscode.TextEditorRevealType.InCenter,
    );
  }

  private static async createDiffView(id: string, relpath: string) {
    const fileUri = vscode.Uri.joinPath(getWorkspaceFolder().uri, relpath);
    const fileExists = await isFileExists(fileUri);
    if (!fileExists) {
      await ensureFileDirectoryExists(fileUri);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from("", "utf-8"));
    }
    const originalContent = (
      await vscode.workspace.fs.readFile(fileUri)
    ).toString();
    const activeDiffEditor = await openDiffEditor(
      id,
      fileUri,
      fileExists,
      originalContent,
    );
    return new DiffView(fileUri, fileExists, activeDiffEditor);
  }

  private static readonly diffViewGetGroup = runExclusive.createGroupRef();
  static readonly getOrCreate = runExclusive.build(
    DiffView.diffViewGetGroup,
    async (id: string, relpath: string) => {
      // Install hook for first diff view
      if (DiffViewMap.size === 0) {
        logger.info("Installing diff view hook");
        const disposable = vscode.workspace.onDidCloseTextDocument((e) => {
          logger.debug(`Closed document ${e.uri.scheme}:${e.uri.fsPath}`);
          if (e.uri.scheme === DiffOriginContentProvider.scheme) {
            const id = e.uri.path; // id is stored in path.
            const diffView = DiffViewMap.get(id);
            if (diffView) {
              diffView.dispose();
              DiffViewMap.delete(id);
              logger.debug(`Closed diff view for ${id}`);
            }

            if (ReuseDiffView) {
              // As we reuse the diff view in openDiffEditor, we need to close all diff views for the same file.
              for (const [id, value] of DiffViewMap) {
                if (value.fileUri.fsPath === e.uri.fragment) {
                  value.dispose();
                  DiffViewMap.delete(id);
                  logger.debug(`Closed diff view for ${id}`);
                }
              }
            }

            logger.debug(`Remaining diff views: ${DiffViewMap.size}`);

            if (DiffViewMap.size === 0) {
              logger.debug("Disposing diff view hook");
              disposable.dispose();
            }
          }
        });
      }

      let diffView = DiffViewMap.get(id);
      if (!diffView) {
        diffView = await this.createDiffView(id, relpath);
        DiffViewMap.set(id, diffView);
        logger.debug(`Opened diff view for ${id}: ${relpath}`);
        logger.debug(`Total diff views: ${DiffViewMap.size}`);
      }

      return diffView;
    },
  );
}

const DiffViewMap = new Map<string, DiffView>();

async function openDiffEditor(
  id: string,
  fileUri: vscode.Uri,
  fileExists: boolean,
  originalContent: string | undefined,
): Promise<vscode.TextEditor> {
  if (ReuseDiffView) {
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (
          tab.input instanceof vscode.TabInputTextDiff &&
          tab.input?.original?.scheme === DiffOriginContentProvider.scheme &&
          tab.input.modified.fsPath === fileUri.fsPath
        ) {
          for (const textEditor of vscode.window.visibleTextEditors) {
            if (textEditor.document.uri.fsPath === fileUri.fsPath) {
              return textEditor;
            }
          }
        }
      }
    }
  }

  // Open new diff editor
  logger.debug("Opening new diff editor", fileUri.fsPath);
  return new Promise<vscode.TextEditor>((resolve, reject) => {
    const fileName = path.basename(fileUri.fsPath);
    const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.uri.fsPath === fileUri.fsPath) {
        disposable.dispose();
        resolve(editor);
      }
    });
    vscode.commands.executeCommand(
      "vscode.diff",
      vscode.Uri.parse(`${DiffOriginContentProvider.scheme}:${id}`).with({
        query: Buffer.from(originalContent ?? "").toString("base64"),
        fragment: fileUri.fsPath,
      }),
      fileUri,
      `${fileName}: ${fileExists ? "Original ↔ Pochi's Changes" : "New File"} (Editable)`,
      {
        preview: false,
        preserveFocus: true,
      },
    );
    // This may happen on very slow machines ie project idx
    setTimeout(() => {
      disposable.dispose();
      reject(new Error("Failed to open diff editor, please try again..."));
    }, 10_000);
  });
}

async function closeAllNonDirtyDiffViews() {
  const tabs = vscode.window.tabGroups.all
    .flatMap((tg) => tg.tabs)
    .filter(
      (tab) =>
        tab.input instanceof vscode.TabInputTextDiff &&
        tab.input?.original?.scheme === DiffOriginContentProvider.scheme,
    );
  for (const tab of tabs) {
    // trying to close dirty views results in save popup
    if (!tab.isDirty) {
      await vscode.window.tabGroups.close(tab);
    }
  }
}
