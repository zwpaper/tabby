import type { Message } from "ai";
import type { DBMessage } from "../db";

export function toUIMessage(message: DBMessage): Message {
  return {
    ...message,
    content: "",
    createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
  };
}

export function toUIMessages(messages: DBMessage[]): Message[] {
  return messages.map(toUIMessage);
}

export function fromUIMessage(message: Message): DBMessage {
  const parts = (message.parts || []).filter((x) => x.type !== "source");
  return {
    ...message,
    createdAt: message.createdAt?.toISOString(),
    parts,
  };
}

export function fromUIMessages(messages: Message[]): DBMessage[] {
  return messages.map(fromUIMessage);
}
