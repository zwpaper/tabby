import { DiffView } from "@/integrations/editor/diff-view";
import type { ClientToolsType } from "@ragdoll/tools";
import type {
  PreviewToolFunctionType,
  ToolFunctionType,
} from "@ragdoll/tools/src/types";

export const previewWriteToFile: PreviewToolFunctionType<
  ClientToolsType["writeToFile"]
> = async (args, { state, toolCallId }) => {
  const { path, content } = args || {};
  if (path === undefined || content === undefined) return;

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(content, state !== "partial-call");
};

/**
 * Implements the writeToFile tool for VSCode extension.
 * Writes content to a specified file, creating directories if needed.
 */
export const writeToFile: ToolFunctionType<
  ClientToolsType["writeToFile"]
> = async ({ path, content }, { toolCallId }) => {
  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(content, true);
  const edits = await diffView.saveChanges(path, content);
  return { success: true, ...edits };
};
