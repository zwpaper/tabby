import { CommandExecutionPanel } from "@/components/message/command-execution-panel";
import { useToolEvents } from "@/lib/stores/chat-state";
import type { ClientToolsType } from "@ragdoll/tools";
import { useCallback } from "react";
import { HighlightedText } from "../highlight-text";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const executeCommandTool: React.FC<
  ToolProps<ClientToolsType["executeCommand"]>
> = ({ tool, isExecuting, streamResult }) => {
  const { emit } = useToolEvents();
  const abortTool = useCallback(() => {
    emit("abortTool", { toolCallId: tool.toolCallId });
  }, [emit, tool.toolCallId]);

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

  let output = streamResult?.result.output || "";
  let completed = false;
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    !("error" in tool.result)
  ) {
    output = tool.result.output;
    completed = true;
  }

  return (
    <ExpandableToolContainer
      title={title}
      detail={
        <CommandExecutionPanel
          command={command ?? ""}
          output={isDevServer ? "" : output}
          onStop={abortTool}
          completed={completed}
          autoScrollToBottom={true}
          isExecuting={isExecuting}
        />
      }
    />
  );
};
