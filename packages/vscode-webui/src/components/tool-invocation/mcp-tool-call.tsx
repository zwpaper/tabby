import { CodeBlock, MessageMarkdown } from "@/components/message";
import { vscodeHost } from "@/lib/vscode";
import { getToolName } from "@ai-v5-sdk/ai";
import { filterPlayrightMarkdown } from "./filter-playwright";
import { HighlightedText } from "./highlight-text";
import { StatusIcon } from "./status-icon";
import { ExpandableToolContainer } from "./tool-container";
import type { ToolProps } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: MCP matches any.
export const McpToolCall: React.FC<ToolProps<any>> = ({
  tool,
  isExecuting,
}) => {
  const toolName = getToolName(tool);
  const { input } = tool;

  let result = undefined;
  if (tool.state === "output-available") {
    result = tool.output ?? "No output";
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
            value={JSON.stringify(input, null, 2)}
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
              <Result result={result} toolName={toolName} />
            </>
          )}
        </div>
      }
    />
  );
};

// biome-ignore lint/suspicious/noExplicitAny: unknown output type
function Result({ result, toolName }: { result: any; toolName: string }) {
  if ("content" in result) {
    return <ContentResult content={result.content} toolName={toolName} />;
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

function ContentResult({
  content,
  toolName,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
}: { content: any[]; toolName: string }) {
  return (
    <div className="space-y-0 px-4 py-2">
      {content.map((item, index) => {
        if (item.type === "image") {
          return (
            <div key={index} className="overflow-hidden">
              <ImageResult {...item} />
            </div>
          );
        }
        if (item.type === "text") {
          // Check if toolName starts with "browser_" and filter accordingly
          const textContent = toolName.toLowerCase().startsWith("browser_")
            ? filterPlayrightMarkdown(item.text)
            : item.text;

          return (
            <div key={index}>
              <MessageMarkdown isMinimalView>{textContent}</MessageMarkdown>
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

  const handleClick = async () => {
    if (data.startsWith("https://")) {
      // External URL - use openExternal instead
      vscodeHost.openExternal(data);
    } else {
      // Base64 data - determine file extension from mimeType
      const extension = mimeType.split("/")[1] || "png";
      const encoder = new TextEncoder();
      const hashArray = await window.crypto.subtle.digest(
        "SHA-256",
        encoder.encode(data),
      );
      const hashHex = Array.from(new Uint8Array(hashArray))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .substring(0, 8); // convert bytes to hex string and take first 8 chars
      const filename = `mcp-image-preview-${hashHex}.${extension}`;
      // Open the file in VS Code
      vscodeHost.openFile(filename, {
        base64Data: data,
      });
    }
  };

  return (
    <div
      className="cursor-pointer bg-[var(--vscode-editor-background)] hover:opacity-80"
      onClick={handleClick}
    >
      <img
        src={src}
        alt="MCP tool response snapshot"
        className="h-auto w-full shadow-sm"
      />
    </div>
  );
}
