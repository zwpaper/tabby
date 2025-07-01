import type { DataStreamWriter, LanguageModelUsage, UIMessage } from "ai";

export type ExtendedStepStartPart = {
  type: "step-start";
  checkpoint?: {
    commit: string; // The commit hash or identifier for the checkpoint
  };
};

export type ExtendedUIMessage = UIMessage & {
  parts: Array<UIMessage["parts"][number] | ExtendedStepStartPart>;
};

/**
 * Check if a message is a ExtendedUIMessage which contains step-start parts with checkpoints.
 * @param message - The message to check.
 * @returns True if the message is an ExtendedUIMessage, false otherwise.
 */
export const isExtendedUIMessage = (
  message: UIMessage,
): message is ExtendedUIMessage => {
  return (
    "parts" in message &&
    Array.isArray(message.parts) &&
    message.parts.some(
      (part) =>
        part.type === "step-start" &&
        "checkpoint" in part &&
        typeof part.checkpoint === "object" &&
        part.checkpoint !== null &&
        "commit" in part.checkpoint &&
        typeof part.checkpoint.commit === "string",
    )
  );
};

export type DBMessage = {
  id: string;
  createdAt: string;
  role: UIMessage["role"];
  parts: Array<Exclude<ExtendedUIMessage["parts"][number], { type: "source" }>>;
  experimental_attachments?: UIMessage["experimental_attachments"];
};

export type DataPart =
  | {
      type: "append-message";
      message: string;
    }
  | {
      type: "append-id";
      uid: string;
    }
  | ({
      type: "update-usage";
    } & LanguageModelUsage);

export function toUIMessage(message: DBMessage): UIMessage {
  return {
    ...message,
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
