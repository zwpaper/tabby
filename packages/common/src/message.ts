import type { DBMessage } from "@ragdoll/db";
import type { DataStreamWriter, LanguageModelUsage, UIMessage } from "ai";

export type DataPart =
  | {
      type: "append-message";
      message: string;
    }
  | {
      type: "append-id";
      uid: string;
    }
  | (
      | ({
          type: "update-usage";
        } & LanguageModelUsage)
      | {
          type: "compact";
          message: DBMessage;
        }
    );

export function toUIMessage(message: DBMessage): UIMessage {
  return {
    // Force conversion to UIMessage
    // @ts-expect-error
    ...(message as UIMessage),
    content: "",
    createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
  };
}

export function toUIMessages(messages: DBMessage[]): UIMessage[] {
  return messages.map(toUIMessage);
}

export function fromUIMessage(message: UIMessage): DBMessage {
  const parts = (message.parts || []).filter((x) => x.type !== "source");
  return {
    ...message,
    createdAt: message.createdAt?.toISOString() || new Date().toISOString(),
    parts,
  };
}

export function fromUIMessages(messages: UIMessage[]): DBMessage[] {
  return messages.map(fromUIMessage);
}

/**
 * For each append message, we check if the message already exists in the messages array.
 * If it does, we overwrite the existing message with the new one.
 * If it doesn't, we append the new message to the messages array.
 * @param messages  The messages to append to
 * @param appendMessages The messages to append
 */
export function appendMessages(
  messages: UIMessage[],
  appendMessages: UIMessage[],
): UIMessage[] {
  const syncMessageId = appendMessages[0].id;
  const syncMessageIndex = messages.findIndex((m) => m.id === syncMessageId);
  if (syncMessageIndex !== -1) {
    return [...messages.slice(0, syncMessageIndex), ...appendMessages];
  }

  return [...messages, ...appendMessages];
}

/**
 * Utility function for writing DataPart objects to a stream
 */
export function appendDataPart(
  dataPart: DataPart,
  writer: DataStreamWriter,
): void {
  switch (dataPart.type) {
    case "append-id":
      writer.writeData(dataPart);
      break;
    case "append-message":
      writer.writeData(dataPart);
      break;
    case "update-usage":
      writer.writeData(dataPart);
      break;
    default:
      throw new Error(`Unknown DataPart type: ${dataPart}`);
  }
}
