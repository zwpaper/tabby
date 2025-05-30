import {
  type ITerminalAddon,
  type ITerminalInitOnlyOptions,
  type ITerminalOptions,
  Terminal,
} from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useToolEvents } from "@/lib/stores/chat-state";
import { FitAddon } from "@xterm/addon-fit";
import {
  type ComponentPropsWithoutRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface UseXTermProps {
  addons?: ITerminalAddon[];
  options?: ITerminalOptions & ITerminalInitOnlyOptions;
  listeners?: {
    onBinary?(data: string): void;
    onCursorMove?(): void;
    onData?(data: string): void;
    onKey?: (event: { key: string; domEvent: KeyboardEvent }) => void;
    onLineFeed?(): void;
    onScroll?(newPosition: number): void;
    onSelectionChange?(): void;
    onRender?(event: { start: number; end: number }): void;
    onResize?(event: { cols: number; rows: number }): void;
    onTitleChange?(newTitle: string): void;
    customKeyEventHandler?(event: KeyboardEvent): boolean;
  };
}

function useXTerm({ options, addons, listeners }: UseXTermProps = {}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const listenersRef = useRef<UseXTermProps["listeners"]>(listeners);
  const [terminalInstance, setTerminalInstance] = useState<Terminal | null>(
    null,
  );

  const addonFit = useRef(new FitAddon());
  const addonList = useMemo(
    () => [addonFit.current, ...(addons ?? [])],
    [addons],
  );

  // Keep the latest version of listeners without retriggering the effect
  useEffect(() => {
    listenersRef.current = listeners;
  }, [listeners]);

  const fit = useCallback(() => {
    if (terminalInstance && terminalRef.current) {
      addonFit.current.fit();
    }
  }, [terminalInstance]);

  useEffect(() => {
    const instance = new Terminal({
      fontFamily:
        "operator mono,SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace",
      fontSize: 12,
      theme: {
        background: window
          .getComputedStyle(document.body)
          .getPropertyValue("--vscode-editor-background"),
      },
      cursorStyle: "underline",
      cursorBlink: false,
      cursorInactiveStyle: "none",
      ...options,
    });

    // Load optional addons
    // biome-ignore lint/complexity/noForEach: <explanation>
    addonList?.forEach((addon) => instance.loadAddon(addon));

    // Register event listeners from the ref
    const l = listenersRef.current;
    l?.onBinary && instance.onBinary(l.onBinary);
    l?.onCursorMove && instance.onCursorMove(l.onCursorMove);
    l?.onLineFeed && instance.onLineFeed(l.onLineFeed);
    l?.onScroll && instance.onScroll(l.onScroll);
    l?.onSelectionChange && instance.onSelectionChange(l.onSelectionChange);
    l?.onRender && instance.onRender(l.onRender);
    l?.onResize && instance.onResize(l.onResize);
    l?.onTitleChange && instance.onTitleChange(l.onTitleChange);
    l?.onKey && instance.onKey(l.onKey);
    l?.onData && instance.onData(l.onData);
    l?.customKeyEventHandler &&
      instance.attachCustomKeyEventHandler(l.customKeyEventHandler);

    if (terminalRef.current) {
      instance.open(terminalRef.current);
    }

    setTerminalInstance(instance);

    return () => {
      instance.dispose();
      setTerminalInstance(null);
    };
  }, [options, addonList]);

  return {
    ref: terminalRef,
    instance: terminalInstance,
    fit,
  };
}

export interface XTermProps
  extends Omit<ComponentPropsWithoutRef<"div">, "onResize" | "onScroll">,
    UseXTermProps {
  // stream content
  content: string;
  containerRef: React.RefObject<HTMLDivElement>;
}

const maxRow = 10;
const minRow = 3;

export function XTerm({
  className = "",
  options,
  listeners,
  content,
  addons,
  containerRef,
  ...props
}: XTermProps) {
  const defaultTerminalOptions = {
    rows: minRow,
  };

  const [xtermOptions, setOptions] = useState<
    ITerminalOptions & ITerminalInitOnlyOptions
  >({ ...defaultTerminalOptions, ...options });

  const { ref, instance } = useXTerm({
    options: xtermOptions,
    addons,
    listeners,
  });

  const { emit } = useToolEvents();

  const writtenLength = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    writtenLength.current = 0;
  }, [instance]);

  useEffect(() => {
    if (!instance) {
      return;
    }
    if (writtenLength.current >= content.length) return;
    instance.write(content.slice(writtenLength.current));
    writtenLength.current = content.length;
  }, [instance, content]);

  useEffect(() => {
    const lineCount = content.split("\n").length;
    const rows = Math.max(Math.min(lineCount, maxRow), minRow);
    const height = rows * 14;
    setOptions((prev) => {
      if (prev.rows === rows) return prev;
      containerRef.current?.style.setProperty("height", `${height}px`);
      emit("resizeTerminal", {
        height,
      });
      return {
        ...prev,
        rows,
      };
    });
  }, [content, containerRef, emit]);

  return <div className={className} ref={ref} {...props} />;
}
