import { CustomHtmlTags } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { type ElementType, type FC, memo, useMemo } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { FileBadge } from "../tool-invocation/file-badge";
import { CodeBlock } from "./code-block";
import { customStripTagsPlugin } from "./custom-strip-tags-plugin";
import "./markdown.css";

type CustomTag = (typeof CustomHtmlTags)[number];

type ExtendedMarkdownOptions = Omit<Options, "components"> & {
  components?: Components & {
    // for custom html tags rendering
    [Tag in CustomTag]?: ElementType;
  };
};

interface MessageMarkdownProps {
  children: string;
  className?: string;
}

interface FileComponentProps {
  children: string;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}\[\]()#+\-.!|<]/g, "\\$&");
}

/**
 * escape markdown content in certain tag, like <file>content to escape</file>
 */
function escapeMarkdownTag(tag: string): (text: string) => string {
  return (text: string): string => {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, "gs");
    return text.replace(regex, (_match, content) => {
      const escapedContent = escapeMarkdown(content);
      return `<${tag}>${escapedContent}</${tag}>`;
    });
  };
}

const MemoizedReactMarkdown: FC<ExtendedMarkdownOptions> = memo(
  ReactMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

export function MessageMarkdown({
  children,
  className,
}: MessageMarkdownProps): JSX.Element {
  const processedChildren = useMemo(() => {
    let result = children;
    for (const tag of CustomHtmlTags) {
      const escapeTagContent = escapeMarkdownTag(tag);
      result = escapeTagContent(result);
    }
    return result;
  }, [children]);

  return (
    <div
      className={cn(
        "prose dark:prose-invert prose-li:my-0 prose-ol:my-0 prose-p:my-0 prose-ul:my-0 prose-pre:mt-1 max-w-none break-words prose-pre:p-0 prose-p:leading-relaxed",
        className,
      )}
    >
      <MemoizedReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [
            customStripTagsPlugin,
            {
              tagNames: CustomHtmlTags,
            },
          ],
          rehypeRaw,
          [
            rehypeSanitize,
            {
              ...defaultSchema,
              tagNames: [...(defaultSchema.tagNames || []), ...CustomHtmlTags],
            },
          ],
        ]}
        components={{
          file: (props: FileComponentProps) => {
            const { children } = props;
            const filepath = String(children);
            return <FileBadge path={filepath} />;
          },
          code({ className, children, ...props }) {
            if (children && Array.isArray(children) && children.length) {
              if (children[0] === "▍") {
                return (
                  <span className="mt-1 animate-pulse cursor-default">▍</span>
                );
              }

              children[0] = (children[0] as string).replace("`▍`", "▍");
            }

            const match = /language-(\w+)/.exec(className || "");

            const isInline =
              props.node?.position &&
              props.node.position.start.line === props.node.position.end.line;

            if (isInline) {
              return (
                <code className={cn("inline-code", className)} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                language={match?.[1] || ""}
                value={String(children).replace(/\n$/, "")}
                canWrapLongLines={true}
              />
            );
          },
          hr() {
            return null;
          },
        }}
      >
        {processedChildren}
      </MemoizedReactMarkdown>
    </div>
  );
}
