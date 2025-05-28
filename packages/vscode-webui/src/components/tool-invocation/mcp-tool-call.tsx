import { CodeBlock } from "@/components/message";
import { useMcp } from "@/lib/hooks/use-mcp";
import { HighlightedText } from "./highlight-text";
import { StatusIcon } from "./status-icon";
import { ExpandableToolContainer } from "./tool-container";
import type { ToolProps } from "./types";

export const McpToolCall: React.FC<Pick<ToolProps, "tool" | "isExecuting">> = ({
  tool,
  isExecuting,
}) => {
  const { toolName, args } = tool;

  const { connections } = useMcp();
  const serverName = Object.entries(connections).find(([, connection]) =>
    Object.keys(connection.tools).includes(tool.toolName),
  )?.[0];

  let result = undefined;
  if (tool.state === "result") {
    result = tool.result ?? "No output";
  }

  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2">
        {"Invoke tool "}
        <span>
          <HighlightedText>{toolName}</HighlightedText>
        </span>
        {serverName && (
          <>
            {" from MCP server "}
            <span>
              <HighlightedText>{serverName}</HighlightedText>
            </span>
          </>
        )}
      </span>
    </>
  );
  return (
    <ExpandableToolContainer
      title={title}
      expandableDetail={
        <>
          <>
            <b>Input</b>
            <CodeBlock
              className="mt-1.5"
              language={"json"}
              value={JSON.stringify(args, null, 2)}
              canWrapLongLines={true}
            />
          </>
          {result && (
            <>
              <b>Output</b>
              <CodeBlock
                className="mt-1.5"
                language={"json"}
                value={JSON.stringify(result, null, 2)}
                canWrapLongLines={true}
              />
            </>
          )}
        </>
      }
    />
  );
};
