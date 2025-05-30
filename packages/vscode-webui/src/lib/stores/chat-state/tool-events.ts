// Define the event types that can be emitted/listened to
export type ToolEventType = "abortTool" | "resizeTerminal"; // Add other event types here, e.g., | "anotherEvent";

// Define the payload shapes for each event type
export interface ToolEventPayloads {
  abortTool: { toolCallId: string };
  resizeTerminal: { height: number };
}

// ToolEvents class to encapsulate event management functionality
export class ToolEvents {
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
