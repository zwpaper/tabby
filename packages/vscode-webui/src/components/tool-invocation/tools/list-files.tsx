import { isFolder } from "@/lib/utils/file";
import type { ClientToolsType } from "@getpochi/tools";
import { useMemo } from "react";
import { FileBadge } from "../file-badge";
import { FileList } from "../file-list";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const listFilesTool: React.FC<
  ToolProps<ClientToolsType["listFiles"]>
> = ({ tool, isExecuting }) => {
  const { path } = tool.args || {};
  const isDirectory = useMemo(() => {
    return isFolder(path ?? "");
  }, [path]);

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

  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      Reading{" "}
      <FileBadge className="ml-1" path={path ?? ""} isDirectory={isDirectory} />
      {tool.state === "result" && (
        <>
          , {files.length} result
          {files.length > 1 ? "s" : ""} {isTruncated && ", results truncated"}
        </>
      )}
    </>
  );

  return <ExpandableToolContainer title={title} expandableDetail={resultEl} />;
};
