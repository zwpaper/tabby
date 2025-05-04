import { CustomHtmlTags } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { FileBadge } from "../tool-invocation/file-badge";
import { customStripTagsPlugin } from "./custom-strip-tags-plugin";

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

// extended react-markdown component
const Markdown = (props: ExtendedMarkdownOptions) => (
  <ReactMarkdown {...props} />
);

export function MessageMarkdown({
  children,
  className,
}: MessageMarkdownProps): JSX.Element {
  return (
    <div
      className={cn(
        "prose max-w-none break-words dark:prose-invert prose-p:leading-relaxed prose-p:my-0 prose-ol:my-0 prose-li:my-0 prose-ul:my-0 prose-pre:mt-1 prose-pre:p-0",
        className,
      )}
    >
      <Markdown
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
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
