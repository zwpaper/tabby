import { Box, Text, useFocus, useInput } from "ink";
import { useState } from "react";

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function Toggle({ value, onChange }: ToggleProps) {
  const [internalValue, setInternalValue] = useState(value);

  const { isFocused } = useFocus({ autoFocus: true });

  useInput(
    (input) => {
      if (input === " ") {
        const newValue = !internalValue;
        setInternalValue(newValue);
        onChange(newValue);
      } else if (input.toLowerCase() === "y") {
        setInternalValue(true);
        onChange(true);
      } else if (input.toLowerCase() === "n") {
        setInternalValue(false);
        onChange(false);
      }
    },
    { isActive: isFocused },
  );

  const textProps = {
    underline: isFocused,
  };

  return (
    <Box>
      <Text bold={internalValue} {...textProps}>
        Y
      </Text>
      <Text {...textProps}> / </Text>
      <Text bold={!internalValue} {...textProps}>
        N
      </Text>
    </Box>
  );
}
