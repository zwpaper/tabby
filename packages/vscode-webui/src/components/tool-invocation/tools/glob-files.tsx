import type { ClientToolsType } from "@ragdoll/tools";
import { FileList } from "../file-list";
import { HighlightedText } from "../highlight-text";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const globFilesTool: React.FC<
  ToolProps<ClientToolsType["globFiles"]>
> = ({ tool, isExecuting }) => {
  const { path, globPattern } = tool.args || {};

  let resultEl: React.ReactNode | null = null;
  let files: string[] = [];
  let isTruncated = false;
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    !("error" in tool.result)
  ) {
    files = tool.result.files;
    isTruncated = tool.result.isTruncated ?? false;
    resultEl =
      files.length > 0 ? (
        <FileList
          matches={files.map((file) => {
            return {
              file,
            };
          })}
        />
      ) : null;
  }

  const searchCondition = (
    <>
      in <HighlightedText>{path}</HighlightedText>
      {globPattern && (
        <>
          for <HighlightedText>{globPattern}</HighlightedText>
        </>
      )}
    </>
  );

  const title = (
    <span>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      <span>
        {isExecuting || tool.state !== "result" ? (
          <>Searching {searchCondition}</>
        ) : (
          <>
            Searched {searchCondition}, {files.length} match
            {files.length > 1 ? "es" : ""}{" "}
            {isTruncated && ", results truncated"}
          </>
        )}
      </span>
    </span>
  );

  return <ExpandableToolContainer title={title} detail={resultEl} />;
};
