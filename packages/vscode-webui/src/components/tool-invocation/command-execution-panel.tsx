import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import {
  CheckIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  TerminalIcon,
} from "lucide-react";
import {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MdOutlineCancel } from "react-icons/md";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { debounceWithCachedValue } from "@/lib/debounce";
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";
import "../message/code-block.css";
import { ScrollArea } from "../ui/scroll-area";

export interface ExecutionPanelProps {
  command: string;
  output: string;
  onStop: () => void;
  autoScrollToBottom?: boolean;
  completed: boolean;
  isExecuting: boolean;
  className?: string;
}

export const CommandExecutionPanel: FC<ExecutionPanelProps> = ({
  command,
  output,
  className,
  onStop,
  autoScrollToBottom,
  isExecuting,
  completed,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<boolean>(true);
  const toggleExpanded = () => setExpanded((prev) => !prev);
  const { isCopied, copyToClipboard } = useCopyToClipboard({
    timeout: 2000,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const onCopy = () => {
    if (isCopied) return;
    copyToClipboard(command);
  };

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // Check if user is near the bottom of the scroll (within 30px threshold)
  const isNearBottom = useCallback(() => {
    if (!containerRef.current) return true; // If no container, assume we should scroll

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const threshold = 30; // pixels from bottom
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, []);

  // Auto scroll only if user is near bottom
  const conditionalScrollToBottom = useCallback(() => {
    if (isNearBottom()) {
      scrollToBottom();
    }
  }, [isNearBottom, scrollToBottom]);

  // Create debounced version of conditionalScrollToBottom to prevent excessive scrolling
  const debouncedScrollToBottom = useMemo(
    () => debounceWithCachedValue(conditionalScrollToBottom, 100),
    [conditionalScrollToBottom],
  );

  // Auto scroll to bottom when value changes if autoScrollToBottom is enabled and user is near bottom
  // biome-ignore lint/correctness/useExhaustiveDependencies: value is needed to trigger scroll on content changes
  useEffect(() => {
    if (autoScrollToBottom) {
      debouncedScrollToBottom();
    }
  }, [autoScrollToBottom, debouncedScrollToBottom, output]);

  // Collapse when execution completes
  useEffect(() => {
    if (!isExecuting && completed) {
      setExpanded(false);
    }
  }, [isExecuting, completed]);

  // Determine if output is too long for syntax highlighting
  const outputTooLong = useMemo(() => {
    const threshold = 5000; // characters
    return output.length > threshold;
  }, [output]);

  return (
    <div
      className={cn(
        "code-block relative w-full rounded-sm border bg-[var(--vscode-editor-background)] font-sans",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full items-center justify-between rounded-t-sm bg-[var(--vscode-editor-background)] py-1.5 pr-3 pl-4 text-[var(--vscode-editor-foreground)]",
          {
            "border-b": output && expanded,
          },
        )}
      >
        <div className="flex space-x-3">
          <TerminalIcon className="mt-1 size-4 flex-shrink-0" />
          <span className="text-accent-foreground">{command}</span>
        </div>
        <div className="flex space-x-3 self-start">
          {!completed && isExecuting && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 p-0 text-xs hover:bg-[#3C382F] hover:text-[#F4F4F5] focus-visible:ring-1 focus-visible:ring-slate-700 focus-visible:ring-offset-0"
                  onClick={onStop}
                >
                  <MdOutlineCancel />
                  <span className="sr-only">Stop</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="m-0">Stop</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 p-0 text-xs hover:bg-[#3C382F] hover:text-[#F4F4F5] focus-visible:ring-1 focus-visible:ring-slate-700 focus-visible:ring-offset-0"
                onClick={toggleExpanded}
              >
                {expanded ? <ChevronsDownUpIcon /> : <ChevronsUpDownIcon />}
                <span className="sr-only">
                  {expanded ? "Collapse" : "Expand"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="m-0">{expanded ? "Collapse" : "Expand"}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 p-0 text-xs hover:bg-[#3C382F] hover:text-[#F4F4F5] focus-visible:ring-1 focus-visible:ring-slate-700 focus-visible:ring-offset-0"
                onClick={onCopy}
              >
                {isCopied ? <CheckIcon /> : <CopyIcon />}
                <span className="sr-only">Copy</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="m-0">Copy</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {output && expanded && (
        <ScrollArea
          ref={containerRef}
          className={cn("flex flex-col", {
            "max-h-[140px]": autoScrollToBottom,
            "overflow-auto": autoScrollToBottom,
          })}
        >
          {outputTooLong ? (
            <pre className="m-0 w-full whitespace-pre-wrap break-words rounded-sm bg-transparent p-4 font-mono text-[var(--vscode-editor-foreground)] text-sm">
              {output}
            </pre>
          ) : (
            // @ts-ignore - Type issue with SyntaxHighlighter
            <SyntaxHighlighter
              language={"log"}
              style={theme === "dark" ? vscDarkPlus : oneLight}
              PreTag="div"
              customStyle={{
                margin: 0,
                width: "100%",
                background: "transparent",
                borderRadius: "0.25rem",
              }}
              wrapLongLines={true}
              codeTagProps={{
                style: {
                  backgroundColor: "transparent",
                  padding: "0px",
                },
              }}
            >
              {output}
            </SyntaxHighlighter>
          )}
        </ScrollArea>
      )}
    </div>
  );
};
