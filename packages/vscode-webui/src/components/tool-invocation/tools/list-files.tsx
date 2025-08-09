import { isFolder } from "@/lib/utils/file";

import { useMemo } from "react";
import { FileBadge } from "../file-badge";
import { FileList } from "../file-list";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const listFilesTool: React.FC<ToolProps<"listFiles">> = ({
  tool,
  isExecuting,
}) => {
  const { path } = tool.input || {};
  const isDirectory = useMemo(() => {
    return isFolder(path ?? "");
  }, [path]);

  let resultEl: React.ReactNode | null = null;
  let files: string[] = [];
  let isTruncated = false;
  if (tool.state === "output-available" && !("error" in tool.output)) {
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

  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      Reading{" "}
      <FileBadge className="ml-1" path={path ?? ""} isDirectory={isDirectory} />
      {tool.state === "output-available" && (
        <>
          , {files.length} result
          {files.length > 1 ? "s" : ""} {isTruncated && ", results truncated"}
        </>
      )}
    </>
  );

  return <ExpandableToolContainer title={title} expandableDetail={resultEl} />;
};
