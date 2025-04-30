import type { ClientToolsType } from "@ragdoll/tools";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const searchFilesTool: React.FC<
  ToolProps<ClientToolsType["searchFiles"]>
> = ({ tool, isExecuting }) => {
  const { path, regex, filePattern } = tool.args || {};

  let resultEl: React.ReactNode;
  let error: string | undefined;
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    !("error" in tool.result)
  ) {
    const { matches } = tool.result;
    const matchCount = matches.length;
    resultEl = (
      <div className="text-sm flex flex-col gap-1">
        {matchCount} matches found
        {matchCount > 0 && (
          <div className="flex flex-col gap-1 overflow-scroll border max-h-[100px]">
            {matches.map((match, index) => (
              <div
                key={match.file + index}
                className="flex gap-2 items-center"
                title={match.context}
              >
                <FileBadge path={match.file} startLine={match.line} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-sm flex flex-col gap-1" title={error}>
      <div className="flex gap-2 items-center">
        <StatusIcon isExecuting={isExecuting} tool={tool} />
        searching in <span>{path}</span> for <span>{regex}</span> matching{" "}
        <span>{filePattern}</span>
      </div>
      {resultEl}
    </div>
  );
};
