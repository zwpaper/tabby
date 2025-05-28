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
              <div className="mt-1.5">
                <Result result={result} />
              </div>
            </>
          )}
        </>
      }
    />
  );
};

// biome-ignore lint/suspicious/noExplicitAny: unknown output type
function Result({ result }: { result: any }) {
  if ("content" in result) {
    return <ContentResult content={result.content} />;
  }
  return (
    <CodeBlock
      language={"json"}
      value={JSON.stringify(result, null, 2)}
      canWrapLongLines={true}
    />
  );
}

// biome-ignore lint/suspicious/noExplicitAny: external data
function ContentResult({ content }: { content: any[] }) {
  return (
    <div className="flex flex-col gap-1">
      {content.map((item, index) => {
        if (item.type === "image") {
          return <ImageResult key={index} {...item} />;
        }
        return (
          <CodeBlock
            key={index}
            language={"json"}
            value={JSON.stringify(item, null, 2)}
            canWrapLongLines={true}
          />
        );
      })}
    </div>
  );
}

function ImageResult({
  data,
  mimeType,
}: { type: "image"; data: string; mimeType: string }) {
  return <img src={`data:${mimeType};base64,${data}`} alt="snapshot" />;
}
