import type { Message as MessageImpl } from "ai";

export type Message = Omit<MessageImpl, "createdAt"> & {
  createdAt?: Date | string;
};

export function toAiMessage(message: Message): MessageImpl {
  return {
    ...message,
    createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
  };
}

export function toAiMessages(messages: Message[]): MessageImpl[] {
  return messages.map(toAiMessage);
}
