import type { ClientToolsType } from "@ragdoll/tools";
import type React from "react";
import { FileList } from "../file-list";
import { HighlightedText } from "../highlight-text";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const searchFilesTool: React.FC<
  ToolProps<ClientToolsType["searchFiles"]>
> = ({ tool, isExecuting }) => {
  const { path, regex, filePattern } = tool.args || {};

  let resultEl: React.ReactNode;
  let matches: { file: string; line: number; context: string }[] = [];
  let isTruncated = false;
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    !("error" in tool.result)
  ) {
    matches = tool.result.matches ?? [];
    isTruncated = tool.result.isTruncated ?? false;
    resultEl =
      matches.length > 0 ? (
        <div className="flex flex-col gap-1 text-sm">
          <FileList matches={matches} />
        </div>
      ) : null;
  }

  const searchCondition = (
    <>
      <HighlightedText>{regex}</HighlightedText> in{" "}
      <HighlightedText>{path}</HighlightedText>
      {filePattern && (
        <>
          matching <HighlightedText>{filePattern}</HighlightedText>
        </>
      )}
    </>
  );

  const title = (
    <span>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      {isExecuting || tool.state !== "result" ? (
        <span>Searching for {searchCondition}</span>
      ) : (
        <span>
          Searched for {searchCondition}, {matches.length} match
          {matches.length > 1 ? "es" : ""}
          {isTruncated && ", results truncated"}
        </span>
      )}
    </span>
  );

  return <ExpandableToolContainer title={title} detail={resultEl} />;
};
