import { Box, Text, useInput } from "ink";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface TextInputProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
}

const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  disabled = false,
  onSubmit = () => {},
  placeholder = "",
}) => {
  // Ensure cursorOffset is within bounds of the actual value length
  const [cursorOffset, setCursorOffset] = useState(value.length);

  // Reset cursor when value changes externally
  const lastValueLengthRef = useRef(value.length);

  useEffect(() => {
    const newLength = value.length;
    const oldLength = lastValueLengthRef.current;
    const lengthDifference = Math.abs(newLength - oldLength);

    if (lengthDifference >= 2) {
      setCursorOffset(newLength);
    }

    lastValueLengthRef.current = newLength;
  }, [value]);

  useInput(
    (input, key) => {
      let newValue = value || "";
      let newCursorOffset = cursorOffset;

      if (key.return) {
        // Enter key
        onSubmit(newValue);
        return;
      }

      if (key.backspace || key.delete) {
        // Backspace
        if (cursorOffset > 0) {
          newValue =
            newValue.slice(0, cursorOffset - 1) + newValue.slice(cursorOffset);
          newCursorOffset--;
        }
      } else if (key.leftArrow) {
        if (cursorOffset > 0) {
          newCursorOffset--;
        }
      } else if (key.rightArrow) {
        if (cursorOffset < newValue.length) {
          newCursorOffset++;
        }
      } else if (
        input &&
        !key.ctrl &&
        !key.meta &&
        !key.tab &&
        !(key.shift && input.length === 0)
      ) {
        // Handle regular character input
        newValue =
          newValue.slice(0, cursorOffset) +
          input +
          newValue.slice(cursorOffset);
        newCursorOffset += input.length;
      } else {
        // Ignore other keys
        return;
      }

      // Prevent cursor offset from going out of bounds
      newCursorOffset = Math.max(0, Math.min(newValue.length, newCursorOffset));

      if (newValue !== value) {
        onChange(newValue);
        // Update cursor position immediately based on the new value length
        setCursorOffset(Math.min(newCursorOffset, newValue.length));
      } else {
        setCursorOffset(newCursorOffset);
      }
    },
    { isActive: !disabled },
  );

  const showPlaceholder = !value && placeholder;

  // Render logic with cursor (always shown)
  const textElements: React.ReactNode[] = [];
  if (showPlaceholder) {
    textElements.push(
      <Text key="placeholder" color="gray">
        {placeholder}
      </Text>,
    );
  } else {
    const effectiveValue = value || "";

    for (let i = 0; i <= effectiveValue.length; i++) {
      const char = effectiveValue[i] || " "; // Use space for cursor at the end
      const isCursorPosition = i === cursorOffset;

      if (isCursorPosition) {
        textElements.push(
          <Text key={`cursor-${i}`} inverse>
            {char}
          </Text>,
        );
      } else if (i < effectiveValue.length) {
        // Don't render the extra space if not cursor
        textElements.push(<Text key={`char-${i}`}>{char}</Text>);
      }
    }
    // Ensure cursor is visible even when input is empty
    if (effectiveValue.length === 0 && cursorOffset === 0) {
      textElements.push(
        <Text key="cursor-empty" inverse>
          {" "}
        </Text>,
      );
    }
  }

  return <Box>{textElements}</Box>;
};

export default TextInput;
