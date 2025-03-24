import type { AttemptCompletionFunctionType } from "@ragdoll/tools";

export const attemptCompletion: AttemptCompletionFunctionType = async ({
  result,
  command,
}) => {
  console.log("attemptCompletion", { result, command });
};