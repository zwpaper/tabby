import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import {
  AlignJustifyIcon,
  CheckIcon,
  CopyIcon,
  WrapTextIcon,
} from "lucide-react";
import { type FC, memo, useState } from "react";
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
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";
import "./code-block.css";

export interface CodeBlockProps {
  language: string;
  value: string;
  onCopyContent?: (value: string) => void;
  canWrapLongLines?: boolean;
  className?: string;
  hidenLanguage?: boolean;
  isMinimalView?: boolean;
}

export const generateRandomString = (length: number, lowercase = false) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXY3456789"; // excluding similar looking characters like Z, 2, I, 1, O, 0
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return lowercase ? result.toLowerCase() : result;
};

const CodeBlock: FC<CodeBlockProps> = memo(
  ({
    language,
    value,
    canWrapLongLines,
    className,
    hidenLanguage,
    isMinimalView,
  }) => {
    const [wrapLongLines, setWrapLongLines] = useState(canWrapLongLines);
    const theme = useTheme();
    const { isCopied, copyToClipboard } = useCopyToClipboard({
      timeout: 2000,
    });

    const onCopy = () => {
      if (isCopied) return;
      copyToClipboard(value);
    };

    // react-syntax-highlighter does not render .toml files correctly
    // using bash syntax as a workaround for better display
    const languageForSyntax = language === "toml" ? "bash" : language;

    return (
      <div
        className={cn(
          "code-block relative flex max-h-[30vh] w-full flex-col rounded-md border bg-[var(--vscode-editor-background)] font-sans",
          className,
        )}
      >
        {!isMinimalView && (
          <div className="flex w-full items-center justify-between rounded-t-sm border-b bg-[var(--vscode-editor-background)] py-1.5 pr-3 pl-4 text-[var(--vscode-editor-foreground)]">
            <span className="text-xs lowercase">
              {!hidenLanguage ? language : ""}
            </span>
            <div className="flex items-center space-x-3">
              {canWrapLongLines && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 p-0 text-xs hover:bg-[#3C382F] hover:text-[#F4F4F5] focus-visible:ring-1 focus-visible:ring-slate-700 focus-visible:ring-offset-0"
                      onClick={() => setWrapLongLines(!wrapLongLines)}
                    >
                      {wrapLongLines ? <AlignJustifyIcon /> : <WrapTextIcon />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="m-0">Toggle word wrap</p>
                  </TooltipContent>
                </Tooltip>
              )}
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
        )}
        <div className="flex-1 overflow-y-auto rounded-b-sm">
          {/* FIXME fix type error */}
          {/* @ts-expect-error */}
          <SyntaxHighlighter
            language={languageForSyntax}
            style={theme === "dark" ? vscDarkPlus : oneLight}
            PreTag="div"
            customStyle={{
              margin: 0,
              width: "100%",
              background: "transparent",
              borderRadius: "0.25rem",
            }}
            wrapLongLines={wrapLongLines}
            codeTagProps={{
              style: {
                backgroundColor: "transparent",
                padding: "0px",
              },
            }}
          >
            {value}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  },
);
CodeBlock.displayName = "CodeBlock";

export { CodeBlock };
