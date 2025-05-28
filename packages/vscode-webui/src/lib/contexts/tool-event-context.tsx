import type React from "react";
import { createContext, useCallback, useContext, useRef } from "react";

// Define the event types that can be emitted/listened to
export type ToolEventType = "abortTool"; // Add other event types here, e.g., | "anotherEvent";

// Define the payload shapes for each event type
export interface ToolEventPayloads {
  abortTool: { toolCallId: string };
}

// Define the context type
interface ToolEventContextType {
  emit: <E extends ToolEventType>(
    eventType: E,
    payload: ToolEventPayloads[E],
  ) => void;
  listen: <E extends ToolEventType>(
    eventType: E,
    listener: (payload: ToolEventPayloads[E]) => void,
  ) => () => void; // Returns an unsubscribe function
}

// Create the context
const ToolEventContext = createContext<ToolEventContextType | undefined>(
  undefined,
);

// Create the provider component
export const ToolEventProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const eventTargetRef = useRef(new EventTarget());

  const emit = useCallback(
    <E extends ToolEventType>(eventType: E, payload: ToolEventPayloads[E]) => {
      eventTargetRef.current.dispatchEvent(
        new CustomEvent<ToolEventPayloads[E]>(eventType, { detail: payload }),
      );
    },
    [],
  );

  const listen = useCallback(
    <E extends ToolEventType>(
      eventType: E,
      listener: (payload: ToolEventPayloads[E]) => void,
    ): (() => void) => {
      const eventListenerWrapper = (event: Event) => {
        const customEvent = event as CustomEvent<ToolEventPayloads[E]>;
        listener(customEvent.detail);
      };

      eventTargetRef.current.addEventListener(eventType, eventListenerWrapper);

      return () => {
        eventTargetRef.current.removeEventListener(
          eventType,
          eventListenerWrapper,
        );
      };
    },
    [],
  );

  return (
    <ToolEventContext.Provider value={{ emit, listen }}>
      {children}
    </ToolEventContext.Provider>
  );
};

// Create a custom hook to use the context
export const useToolEvents = (): ToolEventContextType => {
  const context = useContext(ToolEventContext);
  if (!context) {
    throw new Error("useToolEvents must be used within a ToolEventProvider");
  }
  return context;
};
