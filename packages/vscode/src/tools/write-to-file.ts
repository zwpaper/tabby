import { DiffView } from "@/integrations/editor/diff-view";
import type {
  ClientToolsV5Type,
  PreviewToolFunctionTypeV5,
  ToolFunctionTypeV5,
} from "@getpochi/tools";
import { fixCodeGenerationOutput } from "@ragdoll/common/output-utils";

export const previewWriteToFile: PreviewToolFunctionTypeV5<
  ClientToolsV5Type["writeToFile"]
> = async (args, { state, toolCallId, abortSignal }) => {
  const { path, content } = args || {};
  if (path === undefined || content === undefined) return;

  const processedContent = fixCodeGenerationOutput(content);

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(
    processedContent,
    state !== "partial-call",
    abortSignal,
  );
};

/**
 * Implements the writeToFile tool for VSCode extension.
 * Writes content to a specified file, creating directories if needed.
 */
export const writeToFile: ToolFunctionTypeV5<
  ClientToolsV5Type["writeToFile"]
> = async ({ path, content }, { toolCallId }) => {
  const processedContent = fixCodeGenerationOutput(content);
  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(processedContent, true);
  const edits = await diffView.saveChanges(path, processedContent);
  return { success: true, ...edits };
};
