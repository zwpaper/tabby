import type React from "react";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { debounceWithCachedValue } from "../debounce";

export type ToolCallStreamResult = {
  toolCallId: string;
  result: unknown;
};

// Helper hook to manage tool stream results
function useToolStreamResults() {
  const [toolCallStreamResults, setStreamResults] = useState<
    ToolCallStreamResult[]
  >([]);

  const removeToolStreamResult = useCallback((toolCallId: string): void => {
    setStreamResults((prev) =>
      prev.filter((item) => item.toolCallId !== toolCallId),
    );
  }, []);

  const addToolStreamResult = useCallback(
    debounceWithCachedValue(
      (result: ToolCallStreamResult) => {
        setStreamResults((prev) => {
          const hasExisting = prev.some(
            (item) => item.toolCallId === result.toolCallId,
          );
          if (!hasExisting) {
            return [...prev, result];
          }
          return prev.map((item) =>
            item.toolCallId === result.toolCallId
              ? {
                  ...item,
                  result: result.result,
                }
              : item,
          );
        });
      },
      100,
      { trailing: true, leading: true },
    ),
    [],
  );

  return {
    toolCallStreamResults,
    addToolStreamResult,
    removeToolStreamResult,
  };
}

// Define the event types that can be emitted/listened to
type ToolEventType = "abortTool"; // Add other event types here, e.g., | "anotherEvent";

// Define the payload shapes for each event type
interface ToolEventPayloads {
  abortTool: { toolCallId: string };
}

// ToolEvents class to encapsulate event management functionality
class ToolEvents {
  private eventTarget: EventTarget;

  constructor() {
    this.eventTarget = new EventTarget();
  }

  emit = <E extends ToolEventType>(
    eventType: E,
    payload: ToolEventPayloads[E],
  ): void => {
    this.eventTarget.dispatchEvent(
      new CustomEvent<ToolEventPayloads[E]>(eventType, { detail: payload }),
    );
  };

  listen = <E extends ToolEventType>(
    eventType: E,
    listener: (payload: ToolEventPayloads[E]) => void,
  ): (() => void) => {
    const eventListenerWrapper = (event: Event) => {
      const customEvent = event as CustomEvent<ToolEventPayloads[E]>;
      listener(customEvent.detail);
    };

    this.eventTarget.addEventListener(eventType, eventListenerWrapper);

    return () => {
      this.eventTarget.removeEventListener(eventType, eventListenerWrapper);
    };
  };
}

interface ChatState {
  autoApproveGuard: React.MutableRefObject<boolean>;
  toolEvents: ToolEvents;
  toolStreamResults: {
    value: ToolCallStreamResult[];
    add: (result: ToolCallStreamResult) => void;
    remove: (toolCallId: string) => void;
  };
}

const ChatStateContext = createContext<ChatState | undefined>(undefined);

interface ChatStateProviderProps {
  children: ReactNode;
}

export function ChatStateProvider({ children }: ChatStateProviderProps) {
  const autoApproveGuard = useRef(false);
  const toolEvents = useRef(new ToolEvents()).current;

  const { toolCallStreamResults, addToolStreamResult, removeToolStreamResult } =
    useToolStreamResults();

  const value: ChatState = {
    autoApproveGuard,
    toolEvents,
    toolStreamResults: {
      value: toolCallStreamResults,
      add: addToolStreamResult,
      remove: removeToolStreamResult,
    },
  };

  return (
    <ChatStateContext.Provider value={value}>
      {children}
    </ChatStateContext.Provider>
  );
}

function useChatState(): ChatState {
  const context = useContext(ChatStateContext);
  if (context === undefined) {
    throw new Error("useChatState must be used within a ChatStateProvider");
  }
  return context;
}

// Create a custom hook to use the tool events specifically
export function useToolEvents() {
  const { toolEvents } = useChatState();

  const emit = useCallback(
    <E extends ToolEventType>(eventType: E, payload: ToolEventPayloads[E]) => {
      toolEvents.emit(eventType, payload);
    },
    [toolEvents],
  );

  const listen = useCallback(
    <E extends ToolEventType>(
      eventType: E,
      listener: (payload: ToolEventPayloads[E]) => void,
    ): (() => void) => {
      return toolEvents.listen(eventType, listener);
    },
    [toolEvents],
  );

  return { emit, listen };
}

export function useAutoApproveGuard() {
  const { autoApproveGuard } = useChatState();
  return autoApproveGuard;
}

// Hook to use the stream tool call result functionality
export function useStreamToolCallResult() {
  const { toolStreamResults } = useChatState();

  return {
    toolCallStreamResults: toolStreamResults.value,
    addToolStreamResult: toolStreamResults.add,
    removeToolStreamResult: toolStreamResults.remove,
  };
}
