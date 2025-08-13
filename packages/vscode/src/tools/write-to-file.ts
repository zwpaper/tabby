import { DiffView } from "@/integrations/editor/diff-view";
import { getLogger } from "@/lib/logger";
import { writeTextDocument } from "@/lib/write-text-document";
import type {
  ClientToolsV5Type,
  PreviewToolFunctionTypeV5,
  ToolFunctionTypeV5,
} from "@getpochi/tools";
import { fixCodeGenerationOutput } from "@ragdoll/common/output-utils";

const logger = getLogger("writeToFileTool");

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
> = async ({ path, content }, { toolCallId, abortSignal, nonInteractive }) => {
  const processedContent = fixCodeGenerationOutput(content);

  if (nonInteractive) {
    const edits = await writeTextDocument(path, processedContent, abortSignal);
    logger.debug(
      `Successfully wrote content to ${path} in non-interactive mode`,
    );
    return { success: true, ...edits };
  }

  const diffView = await DiffView.getOrCreate(toolCallId, path);
  await diffView.update(processedContent, true);
  const edits = await diffView.saveChanges(path, processedContent);
  return { success: true, ...edits };
};
