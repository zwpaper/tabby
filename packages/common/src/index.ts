import {
  injectEnvironmentDetails,
  stripEnvironmentDetails,
} from "./prompts/environment";
import { generateSystemPrompt } from "./prompts/system";

export type UserEvent = {
  type: string;
  data: unknown;
};

export type { Todo } from "./todo";
export { ZodEnvironment, type Environment } from "./environment";
export {
  type DBMessage,
  toUIMessage,
  toUIMessages,
  fromUIMessage,
  fromUIMessages,
} from "./message";

export const prompts = {
  system: generateSystemPrompt,
  injectEnvironmentDetails,
  stripEnvironmentDetails,
};

export { formatters } from "./formatters";
