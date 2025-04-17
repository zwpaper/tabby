import { Box, Text } from "ink";
import { useMemo } from "react";

export interface TruncatedTextProps extends React.ComponentProps<typeof Text> {
  children: string;
  maxLines?: number;
  hiddenLinesSuffix?: string;
}

export default function TruncatedText({
  children,
  maxLines = 5,
  hiddenLinesSuffix = "more lines",
  ...props
}: TruncatedTextProps) {
  const { visibleContent, hiddenCount } = useMemo(() => {
    if (!children) return { visibleContent: "", hiddenCount: 0 };

    const lines = children.split("\n");
    if (lines.length <= maxLines) {
      return { visibleContent: children, hiddenCount: 0 };
    }

    const visibleLines = lines.slice(0, maxLines);
    const hiddenCount = lines.length - maxLines;

    return {
      visibleContent: visibleLines.join("\n"),
      hiddenCount,
    };
  }, [children, maxLines]);

  if (!hiddenCount) {
    return <Text {...props}>{children}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text {...props}>{visibleContent}</Text>
      <Text color="gray">
        ... ( {hiddenCount} {hiddenLinesSuffix} )
      </Text>
    </Box>
  );
}
