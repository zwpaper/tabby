import type React from "react";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useRef,
} from "react";

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
}

const ChatStateContext = createContext<ChatState | undefined>(undefined);

interface ChatStateProviderProps {
  children: ReactNode;
}

export function ChatStateProvider({ children }: ChatStateProviderProps) {
  const autoApproveGuard = useRef(false);
  const toolEvents = useRef(new ToolEvents()).current;

  const value: ChatState = {
    autoApproveGuard,
    toolEvents,
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
