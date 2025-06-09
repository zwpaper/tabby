import type { UserEvent } from "@ragdoll/db";

export type UserEventDataHelper<T extends UserEvent["type"]> = Extract<
  UserEvent,
  { type: T }
>["data"];

export {
  appendDataPart,
  fromUIMessage,
  fromUIMessages,
  toUIMessage,
  toUIMessages,
  type DataPart,
  type DBMessage,
} from "./message";
export { mergeTodos, findTodos } from "./todo-utils";

export { formatters } from "./formatters";
export { attachTransport, getLogger } from "./logger";
export { prompts } from "./prompts";

export { SocialLinks } from "./social";
