import { useToolCallLifeCycle } from "@/features/chat";
import type { ClientToolsType } from "@ragdoll/tools";
import { useCallback } from "react";
import { CommandExecutionPanel } from "../command-execution-panel";
import { HighlightedText } from "../highlight-text";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const executeCommandTool: React.FC<
  ToolProps<ClientToolsType["executeCommand"]>
> = ({ tool, isExecuting }) => {
  const lifecycle = useToolCallLifeCycle().getToolCallLifeCycle({
    toolName: tool.toolName,
    toolCallId: tool.toolCallId,
  });
  const abortTool = useCallback(() => {
    lifecycle.abort();
  }, [lifecycle.abort]);

  const { cwd, command, isDevServer } = tool.args || {};
  const cwdNode = cwd ? (
    <span>
      {" "}
      in <HighlightedText>{cwd}</HighlightedText>
    </span>
  ) : null;
  const text = isDevServer
    ? "I will start a dev server"
    : "I will execute the following command";
  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2">
        {text}
        {cwdNode}
      </span>
    </>
  );

  const { streamingResult } = lifecycle;

  if (streamingResult && streamingResult.toolName !== "executeCommand") {
    throw new Error("Unexpected streaming result for executeCommand tool");
  }

  let output = streamingResult?.output.content || "";
  let completed = false;
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    "output" in tool.result
  ) {
    output = tool.result.output;
    completed = true;
  }

  const onDetach = streamingResult
    ? () => {
        streamingResult.detach();
      }
    : undefined;

  return (
    <ExpandableToolContainer
      title={title}
      detail={
        <CommandExecutionPanel
          command={command ?? ""}
          output={output}
          onStop={abortTool}
          onDetach={onDetach}
          completed={completed}
          isExecuting={isExecuting}
        />
      }
    />
  );
};
