import type { ClientToolsType } from "@ragdoll/tools";
import { useState } from "react";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

// Helper function to parse diff content
const parseDiffContent = (diff: string) => {
  try {
    const diffBlocks = diff.trim().split("\n=======\n");
    if (diffBlocks.length !== 2) {
      return { searchContent: "Invalid diff format", replaceContent: "" };
    }

    let searchContent = diffBlocks[0];
    let replaceContent = diffBlocks[1];

    // Remove the SEARCH prefix
    const searchPrefix = "<<<<<<< SEARCH\n";
    if (searchContent.startsWith(searchPrefix)) {
      searchContent = searchContent.slice(searchPrefix.length);
    }

    // Remove the REPLACE suffix
    const suffixWithNewline = "\n>>>>>>> REPLACE";
    const suffixWithoutNewline = ">>>>>>> REPLACE";
    if (replaceContent.endsWith(suffixWithNewline)) {
      replaceContent = replaceContent.slice(0, -suffixWithNewline.length);
    } else if (replaceContent.endsWith(suffixWithoutNewline)) {
      replaceContent = replaceContent.slice(0, -suffixWithoutNewline.length);
    }

    return { searchContent, replaceContent };
  } catch (error) {
    return { searchContent: "Error parsing diff", replaceContent: "" };
  }
};

export const applyDiffTool: React.FC<
  ToolProps<ClientToolsType["applyDiff"]>
> = ({ tool, isExecuting }) => {
  const { path, diff, startLine, endLine } = tool.args || {};
  const [showDiff, setShowDiff] = useState(false);

  let error: string | undefined;
  if (tool.state === "result" && "error" in tool.result) {
    error = tool.result.error;
  }

  // Determine if the operation was successful
  const isSuccess =
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    "success" in tool.result &&
    tool.result.success === true;

  // Parse the diff content if available
  const diffContent = diff ? parseDiffContent(diff) : null;

  return (
    <div className="flex flex-col gap-1 text-sm" title={error}>
      <div className="flex items-center gap-2">
        <StatusIcon isExecuting={isExecuting} tool={tool} />
        {isExecuting ? "Applying" : isSuccess ? "Applied" : "Apply"} diff to
        {path && (
          <FileBadge path={path} startLine={startLine} endLine={endLine} />
        )}
      </div>

      {diff && startLine && endLine && (
        <button
          type="button"
          className="mt-1 w-full cursor-pointer border-none bg-transparent p-0 text-left text-gray-500 text-xs hover:text-gray-400"
          onClick={() => setShowDiff(!showDiff)}
        >
          Modifying lines {startLine} to {endLine} {showDiff ? "▼" : "▶"}
        </button>
      )}

      {showDiff && diffContent && (
        <div className="mt-1 max-h-[300px] overflow-auto rounded border border-gray-700 bg-gray-900 p-2 text-xs">
          <div className="font-bold text-red-400">SEARCH:</div>
          <pre className="mb-2 whitespace-pre-wrap border-red-400 border-l-2 pl-2 text-gray-300">
            {diffContent.searchContent}
          </pre>

          <div className="font-bold text-green-400">REPLACE:</div>
          <pre className="whitespace-pre-wrap border-green-400 border-l-2 pl-2 text-gray-300">
            {diffContent.replaceContent}
          </pre>
        </div>
      )}
    </div>
  );
};
