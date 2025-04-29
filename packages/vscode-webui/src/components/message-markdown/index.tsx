import { cn } from "@/lib/utils";
import React from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { FileBadge } from "../tool-invocation/file-badge";

interface MessageMarkdownProps {
  children: string;
  className?: string;
}

function InlineFileTag({ path }: { path: string }): JSX.Element {
  return <FileBadge path={path} />;
}

/**
 * Process file placeholders in text and render them as badges
 */
function processPlaceholders(text: string): ReactNode | string {
  // Regex to match [file:name] pattern
  const FILE_REGEX = /\[file:([^\]]+)\]/g;
  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let matchResult: RegExpExecArray | null;

  // Using a separate statement to avoid linter error
  while (true) {
    matchResult = FILE_REGEX.exec(text);
    if (matchResult === null) break;

    if (matchResult.index > lastIndex) {
      elements.push(text.slice(lastIndex, matchResult.index));
    }

    const filename = matchResult[1];
    elements.push(<InlineFileTag key={matchResult.index} path={filename} />);
    lastIndex = matchResult.index + matchResult[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? <>{elements}</> : text;
}

export function MessageMarkdown({
  children,
  className,
}: MessageMarkdownProps): JSX.Element {
  return (
    <div
      className={cn(
        "prose max-w-none break-words dark:prose-invert prose-p:leading-relaxed prose-p:my-0 prose-ol:my-0 prose-ul:my-0 prose-pre:mt-1 prose-pre:p-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        components={{
          p: ({ children }) => {
            if (!children) return <p />;

            return (
              <p>
                {React.Children.map(children, (child, index) =>
                  typeof child === "string" ? (
                    processPlaceholders(child)
                  ) : (
                    <React.Fragment key={index}>{child}</React.Fragment>
                  ),
                )}
              </p>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
