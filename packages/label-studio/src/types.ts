import { z } from "zod";

export const ZodPartType = z.object({
  type: z.literal("text"),
  text: z.string(),
  newText: z.string().optional(),
  isDeleted: z.boolean().optional(),
});

export const ZodPartListType = z.array(ZodPartType);

export const ZodMessageType = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: ZodPartListType,
  isDeleted: z.boolean().optional(),
});

export const ZodMessageListType = z.array(ZodMessageType);

export const ZodTaskDataType = z.object({
  uid: z.string(),
  messages: ZodMessageListType,
  verified: z.boolean().optional(),
  excluded: z.boolean().optional(),
});

export type Part = z.infer<typeof ZodPartType>;
export type PartList = z.infer<typeof ZodPartListType>;
export type Message = z.infer<typeof ZodMessageType>;
export type MessageList = z.infer<typeof ZodMessageListType>;
export type TaskData = z.infer<typeof ZodTaskDataType>;

// Types used for converting
// - the content is a string rather than a list of parts
//   - will be converted to a text part
// - reasoning parts
//   - will be discarded
// - other types parts, e.g. image
//   - will throw an error

export const ZodCompatiblePartType = z.object({
  type: z.string(),
  isDeleted: z.boolean().optional(),
});

export const ZodCompatiblePartListType = z.array(
  ZodPartType.or(ZodCompatiblePartType),
);

export const ZodCompatibleMessageType = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: ZodCompatiblePartListType.or(z.string()),
  isDeleted: z.boolean().optional(),
});

export const ZodCompatibleMessageListType = z.array(ZodCompatibleMessageType);

export const ZodCompatibleTaskDataType = z.object({
  uid: z.string(),
  messages: ZodCompatibleMessageListType,
  verified: z.boolean().optional(),
  excluded: z.boolean().optional(),
});

export type CompatiblePart = z.infer<typeof ZodCompatiblePartType>;
export type CompatiblePartList = z.infer<typeof ZodCompatiblePartListType>;
export type CompatibleMessage = z.infer<typeof ZodCompatibleMessageType>;
export type CompatibleMessageList = z.infer<
  typeof ZodCompatibleMessageListType
>;
export type CompatibleTaskData = z.infer<typeof ZodCompatibleTaskDataType>;

// Gemini types
export const ZodGeminiDataType = z.object({
  systemInstruction: z.object({
    role: z.literal("system"),
    parts: z.array(
      z.object({
        text: z.string(),
      }),
    ),
  }),
  contents: z.array(
    z.object({
      role: z.enum(["user", "model"]),
      parts: z.array(
        z.object({
          text: z.string(),
        }),
      ),
    }),
  ),
});

export type GeminiData = z.infer<typeof ZodGeminiDataType>;

// Conversion functions
export function toMessage(compatibleMessage: CompatibleMessage): Message {
  if (typeof compatibleMessage.content === "string") {
    return {
      ...compatibleMessage,
      content: [
        {
          type: "text",
          text: compatibleMessage.content,
        },
      ],
    };
  }
  return {
    ...compatibleMessage,
    content: compatibleMessage.content.filter((part): part is Part => {
      switch (part.type) {
        case "text":
          return true;
        case "reasoning":
          return false; // discard reasoning parts
        default:
          throw new Error(`Unsupported part type: ${part.type}`);
      }
    }),
  };
}

export function toMessageList(
  compatibleMessageList: CompatibleMessageList,
): Message[] {
  return compatibleMessageList.map((message) => {
    return toMessage(message);
  });
}

export function toTaskData(compatibleTaskData: CompatibleTaskData): TaskData {
  return {
    ...compatibleTaskData,
    messages: toMessageList(compatibleTaskData.messages),
  };
}
