import { addLineBreak } from "@/lib/utils/file";

export const HighlightedText: React.FC<{ children?: string }> = ({
  children,
}) => {
  if (!children) {
    return null;
  }
  return (
    <span className="mx-1 break-words rounded bg-muted px-1 font-bold font-mono text-foreground">
      {addLineBreak(children)}
    </span>
  );
};
