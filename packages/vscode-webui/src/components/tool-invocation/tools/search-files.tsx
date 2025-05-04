import { vscodeHost } from "@/lib/vscode";
import type { ClientToolsType } from "@ragdoll/tools";
import { ChevronRight } from "lucide-react";
import { File } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

const getFileName = (filePath: string) => {
  const parts = filePath.split("/");
  return parts[parts.length - 1];
};

const HighlightedText: React.FC<{ children?: string }> = ({ children }) => {
  return (
    <span className="font-mono text-yellow-300 bg-muted p-1 mx-1 rounded">
      {children}
    </span>
  );
};

export const FileList: React.FC<{
  matches: { file: string; line: number; context: string }[];
}> = ({ matches }) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  return (
    <div className="flex flex-col gap-1 overflow-scroll border rounded max-h-[100px] p-1">
      {matches.map((match, index) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: <explanation>
        <div
          key={match.file + match.line + index}
          className={`flex gap-2 items-center cursor-pointer  rounded p-1 ${activeIndex === index ? "bg-border" : "hover:bg-muted"}`}
          title={match.context}
          onClick={() => {
            setActiveIndex(index);
            vscodeHost.openFile(match.file, { line: match.line - 1 });
          }}
        >
          <File className="size-3 shrink-0" />
          <span className="text-gray-300 whitespace-nowrap font-semibold">
            {getFileName(match.file)}
            <span className="text-gray-500">:{match.line}</span>
          </span>
          <span
            title={match.file}
            className="text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {match.file}
          </span>
        </div>
      ))}
    </div>
  );
};

export const searchFilesTool: React.FC<
  ToolProps<ClientToolsType["searchFiles"]>
> = ({ tool, isExecuting }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { path, regex, filePattern } = tool.args || {};

  let resultEl: React.ReactNode;
  let error: string | undefined;
  let matches: { file: string; line: number; context: string }[] = [];
  if (
    tool.state === "result" &&
    "error" in tool.result &&
    typeof tool.result.error === "string"
  ) {
    error = tool.result.error;
  }
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    !("error" in tool.result)
  ) {
    matches = tool.result.matches ?? [];
    resultEl = (
      <div className="text-sm flex flex-col gap-1">
        <FileList matches={matches} />
      </div>
    );
  }

  const searchCondition = (
    <>
      <HighlightedText>{regex}</HighlightedText> in{" "}
      <HighlightedText>{path}</HighlightedText>
      {filePattern && (
        <>
          matching <HighlightedText>{filePattern}</HighlightedText>
        </>
      )}
    </>
  );

  return (
    <div className="text-sm flex flex-col gap-1">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
      <div
        className="flex gap-2 items-center hover:bg-muted rounded p-1 cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        {(matches.length > 0 || error) && (
          // Use self-start to align this item to the top within the flex container
          <span className="bg-muted rounded p-1 my-1 self-start">
            {showDetails ? (
              <ChevronRight className="rotate-90 size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </span>
        )}
        {/* Use self-start to align this item to the top. Assumes StatusIcon accepts and applies className */}
        <span className="py-1.5 self-start">
          <StatusIcon isExecuting={isExecuting} tool={tool} />
        </span>
        {(isExecuting || tool.state !== "result") && (
          <span className="text-gray-400 leading-7">
            Searching for {searchCondition}
          </span>
        )}
        {error && (
          <span className="text-gray-400 leading-7" title={error}>
            Searching for {searchCondition} encountered an error.
          </span>
        )}
        {matches.length > 0 && (
          <span className="text-gray-400 leading-7">
            Searched for {searchCondition}, found {matches.length} match
            {matches.length > 1 ? "es" : ""}
          </span>
        )}
        {tool.state === "result" && matches.length === 0 && !error && (
          <span className="text-gray-400 leading-7">
            Searched for {searchCondition}, no matches found
          </span>
        )}
      </div>
      {showDetails && (
        <>
          {matches.length > 0 && resultEl}
          {error && (
            <span className="text-gray-400 bg-muted rounded text-red-400">
              {error}
            </span>
          )}
        </>
      )}
    </div>
  );
};
