import { Text } from "ink";
import { parse, setOptions } from "marked";
import TerminalRenderer, {
  type TerminalRendererOptions,
} from "marked-terminal";
import React from "react";

export type Props = TerminalRendererOptions & {
  children: string;
};

export default function Markdown({ children, ...options }: Props) {
  setOptions({ renderer: new TerminalRenderer(options) as any });
  return <Text>{parse(children).trim()}</Text>;
}
