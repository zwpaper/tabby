import { Box, Text, useFocus, useInput } from "ink";
import { useEffect, useState } from "react";

export default function Collapsible({
  children,
  title,
  open,
  ...props
}: {
  children: React.ReactNode;
  title: string;
  open?: boolean;
} & React.ComponentProps<typeof Box>) {
  const [activate, setActivate] = useState(!!open);
  useEffect(() => {
    setActivate(!!open);
  }, [open]);
  const { isFocused } = useFocus({ autoFocus: false });
  useInput((_, key) => {
    if (isFocused && key.return) {
      setActivate(!activate);
    }
  });
  return (
    <Box flexDirection="column" gap={1} {...props}>
      <Box gap={1}>
        <Text underline={isFocused}>
          [{activate ? "-" : "+"}] {title}
        </Text>
      </Box>
      {activate && children}
    </Box>
  );
}
