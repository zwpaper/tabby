export const HighlightedText: React.FC<{ children?: string }> = ({
  children,
}) => {
  return (
    <span className="mx-1 break-words rounded bg-muted px-1 font-bold font-mono text-foreground">
      {children}
    </span>
  );
};
