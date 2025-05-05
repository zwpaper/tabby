import type { ClientToolsType } from "@ragdoll/tools";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const globFilesTool: React.FC<
  ToolProps<ClientToolsType["globFiles"]>
> = ({ tool, isExecuting }) => {
  const { path, globPattern } = tool.args || {};

  let resultEl: React.ReactNode | null = null;
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    !("error" in tool.result)
  ) {
    const { files, isTruncated } = tool.result;
    const fileCount = files.length;

    resultEl = (
      <>
        {fileCount} matches
        {isTruncated && ", results truncated"}
      </>
    );
  }

  return (
    <div className="text-sm">
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      Searching in <span className="font-mono">{path}</span> for pattern{" "}
      <span className="font-mono font-bold">{globPattern}</span>
      {resultEl && <span>, {resultEl}</span>}
    </div>
  );
};
