import * as nodePath from "node:path";
import { getWorkspaceFolder } from "@/lib/fs";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { fileTypeFromBuffer } from "file-type";
import * as vscode from "vscode";

// Only add line number prefix when running tests
const AddLineNumberPrefix = !!process.env.VSCODE_TEST_OPTIONS;

export const readFile: ToolFunctionType<ClientToolsType["readFile"]> = async ({
  path,
  startLine,
  endLine,
}) => {
  const workspaceFolder = getWorkspaceFolder();

  const fileUri = vscode.Uri.file(
    nodePath.join(workspaceFolder.uri.fsPath, path),
  );

  const fileBuffer = await vscode.workspace.fs.readFile(fileUri);
  const type = await fileTypeFromBuffer(fileBuffer);

  if (type && !type.mime.startsWith("text/")) {
    throw new Error(
      `The file is binary or not plain text (detected type: ${type.mime}).`,
    );
  }

  const fileContent = fileBuffer.toString();
  const lines = fileContent.split("\n");

  const start = startLine ? startLine - 1 : 0;
  const end = endLine ? endLine : lines.length;

  // Select the relevant lines
  let selectedLines = lines.slice(start, end);

  // Add line numbers if the global flag is true
  if (AddLineNumberPrefix) {
    selectedLines = selectedLines.map(
      (line, index) => `${start + index + 1} | ${line}`,
    );
  }

  let content = selectedLines.join("\n");

  let isTruncated = false;
  // Check byte length and truncate if necessary
  if (Buffer.byteLength(content, "utf-8") > 1_048_576) {
    // This truncation might cut off mid-line or mid-number, which is a simplification.
    // A more robust solution would truncate line by line, but this matches the previous behavior's limit.
    content = content.slice(0, 1_048_576);
    isTruncated = true;
  }

  return { content: content, isTruncated };
};
