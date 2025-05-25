import {
  injectEnvironmentDetails,
  stripEnvironmentDetails,
} from "./environment";
import { generateSystemPrompt } from "./system";

export const prompts = {
  system: generateSystemPrompt,
  injectEnvironmentDetails,
  stripEnvironmentDetails,
};
