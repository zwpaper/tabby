import { CodeBlock, MessageMarkdown } from "@/components/message";
import { HighlightedText } from "./highlight-text";
import { StatusIcon } from "./status-icon";
import { ExpandableToolContainer } from "./tool-container";
import type { ToolProps } from "./types";

export const McpToolCall: React.FC<Pick<ToolProps, "tool" | "isExecuting">> = ({
  tool,
  isExecuting,
}) => {
  const { toolName, args } = tool;

  let result = undefined;
  if (tool.state === "result") {
    result = tool.result ?? "No output";
  }

  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2">
        Calling
        <HighlightedText>{toolName}</HighlightedText>
      </span>
    </>
  );
  return (
    <ExpandableToolContainer
      title={title}
      expandableDetail={
        <div className="overflow-hidden rounded-lg border bg-[var(--vscode-editor-background)]">
          {/* Request Section */}
          <div className="border-[var(--vscode-widget-border)] border-b bg-[var(--vscode-editorGroupHeader-tabsBackground)] px-4 py-2">
            <span className="font-medium text-[var(--vscode-editor-foreground)] text-sm">
              Request
            </span>
          </div>
          <CodeBlock
            language={"json"}
            value={JSON.stringify(args, null, 2)}
            canWrapLongLines={true}
            isMinimalView={true}
            className="border-0"
          />

          {/* Response Section */}
          {result && (
            <>
              <div className="border-[var(--vscode-widget-border)] border-t border-b bg-[var(--vscode-editorGroupHeader-tabsBackground)] px-4 py-2">
                <span className="font-medium text-[var(--vscode-editor-foreground)] text-sm">
                  Response
                </span>
              </div>
              <Result result={result} />
            </>
          )}
        </div>
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
    <div className="p-0">
      <CodeBlock
        language={"json"}
        value={JSON.stringify(result, null, 2)}
        canWrapLongLines={true}
        isMinimalView={true}
        className="border-0"
      />
    </div>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: external data
function ContentResult({ content }: { content: any[] }) {
  return (
    <div className="space-y-0">
      {content.map((item, index) => {
        if (item.type === "image") {
          return (
            <div key={index} className="overflow-hidden">
              <ImageResult {...item} />
            </div>
          );
        }
        if (item.type === "text") {
          return (
            <div key={index}>
              <MessageMarkdown isMinimalView>{item.text}</MessageMarkdown>
            </div>
          );
        }
        return (
          <div key={index}>
            <div className="p-0">
              <CodeBlock
                language={"json"}
                value={JSON.stringify(item, null, 2)}
                canWrapLongLines={true}
                isMinimalView={true}
                className="border-0"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ImageResult({
  data,
  mimeType,
}: { type: "image"; data: string; mimeType: string }) {
  const src = data.startsWith("https://")
    ? data
    : `data:${mimeType};base64,${data}`;
  return (
    <div className="bg-[var(--vscode-editor-background)]">
      <img
        src={src}
        alt="MCP tool response snapshot"
        className="h-auto w-full shadow-sm"
      />
    </div>
  );
}
