import type { DataStreamWriter, LanguageModelUsage, Message } from "ai";

export type DBMessage = {
  id: string;
  createdAt: string;
  role: Message["role"];
  parts: Array<
    Exclude<NonNullable<Message["parts"]>[number], { type: "source" }>
  >;
  experimental_attachments?: Message["experimental_attachments"];
};

export type DataPart =
  | {
      type: "append-message";
      message: string;
    }
  | {
      type: "append-id";
      id: number;
    }
  | ({
      type: "update-usage";
    } & LanguageModelUsage);

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
    createdAt: message.createdAt?.toISOString() || new Date().toISOString(),
    parts,
  };
}

export function fromUIMessages(messages: Message[]): DBMessage[] {
  return messages.map(fromUIMessage);
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
