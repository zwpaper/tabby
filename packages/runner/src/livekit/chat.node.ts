import {
  AbstractChat,
  type ChatInit,
  type ChatState,
  type ChatStatus,
} from "@ai-v5-sdk/ai";
import type { Message } from "@getpochi/livekit";

class NodeChatState implements ChatState<Message> {
  messages: Message[];
  status: ChatStatus = "ready";
  error: Error | undefined = undefined;

  constructor(initialMessages: Message[] = []) {
    this.messages = initialMessages;
  }

  pushMessage = (message: Message) => {
    this.messages = this.messages.concat(message);
  };

  popMessage = () => {
    this.messages = this.messages.slice(0, -1);
  };

  replaceMessage = (index: number, message: Message) => {
    this.messages = [
      ...this.messages.slice(0, index),
      // We deep clone the message here to ensure the new React Compiler (currently in RC) detects deeply nested parts/metadata changes:
      this.snapshot(message),
      ...this.messages.slice(index + 1),
    ];
  };

  snapshot = <T>(value: T): T => structuredClone(value);
}

export class Chat extends AbstractChat<Message> {
  constructor({ messages, ...init }: ChatInit<Message>) {
    const state = new NodeChatState(messages);
    super({ ...init, state });
  }

  appendMessage(message: Message) {
    const index = this.state.messages.findIndex((m) => m.id === message.id);
    if (index === -1) {
      this.state.pushMessage(message);
    } else {
      this.state.replaceMessage(index, message);
    }
  }
}
