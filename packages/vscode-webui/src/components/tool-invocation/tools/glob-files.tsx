import { FileList } from "../file-list";
import { HighlightedText } from "../highlight-text";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const globFilesTool: React.FC<ToolProps<"globFiles">> = ({
  tool,
  isExecuting,
}) => {
  const { path, globPattern } = tool.input || {};

  let resultEl: React.ReactNode | null = null;
  let files: string[] = [];
  let isTruncated = false;
  if (
    tool.state === "output-available" &&
    typeof tool.output === "object" &&
    tool.output !== null &&
    !("error" in tool.output)
  ) {
    files = tool.output.files;
    isTruncated = tool.output.isTruncated ?? false;
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
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      <span>
        {isExecuting || tool.state !== "output-available" ? (
          <>Searching {searchCondition}</>
        ) : (
          <>
            Searching {searchCondition}, {files.length} match
            {files.length > 1 ? "es" : ""}{" "}
            {isTruncated && ", results truncated"}
          </>
        )}
      </span>
    </>
  );

  return <ExpandableToolContainer title={title} expandableDetail={resultEl} />;
};
