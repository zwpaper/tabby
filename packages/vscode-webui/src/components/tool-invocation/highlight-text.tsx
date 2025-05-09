export const HighlightedText: React.FC<{ children?: string }> = ({
  children,
}) => {
  return (
    <span className="mx-1 rounded bg-muted p-1 font-bold font-mono text-foreground">
      {children}
    </span>
  );
};
