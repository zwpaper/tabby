import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

interface MessageMarkdownProps {
  children: string;
  className?: string;
}

export function MessageMarkdown({ children, className }: MessageMarkdownProps) {
  return (
    <div
      className={cn(
        "prose max-w-none break-words dark:prose-invert prose-p:leading-relaxed prose-p:my-2 prose-ol:my-3 prose-ul:my-3 prose-pre:mt-1 prose-pre:p-0",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
