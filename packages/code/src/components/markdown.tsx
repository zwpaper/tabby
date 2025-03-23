import { Text } from "ink";
import { parse, setOptions } from "marked";
import TerminalRenderer, {
  type TerminalRendererOptions,
} from "marked-terminal";

export type Props = TerminalRendererOptions & {
  children: string;
};

export default function Markdown({ children, ...options }: Props) {
  // biome-ignore lint/suspicious/noExplicitAny: hack to convert type
  setOptions({ renderer: new TerminalRenderer(options) as any });
  return <Text>{parse(children).trim()}</Text>;
}
