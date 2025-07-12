import {
  injectEnvironmentDetails,
  stripEnvironmentDetails,
} from "./environment";
import { generateSystemPrompt } from "./system";

export const prompts = {
  system: generateSystemPrompt,
  injectEnvironmentDetails,
  stripEnvironmentDetails,

  createUserReminder,
  isUserReminder,
};

function createUserReminder(content: string) {
  return `<user-reminder>${content}</user-reminder>`;
}

function isUserReminder(content: string) {
  return (
    content.startsWith("<user-reminder>") &&
    content.endsWith("</user-reminder>")
  );
}
