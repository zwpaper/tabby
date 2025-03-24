import type { AskFollowupQuestionFunctionType } from "@ragdoll/tools";

export const askFollowupQuestion: AskFollowupQuestionFunctionType = async ({
  question,
  followUp,
}) => {
  if (!question || followUp.length < 2 || followUp.length > 4) {
    throw new Error(
      "Invalid input. Ensure the question is provided and followUp contains 2-4 suggested answers."
    );
  }

  // Simulate asking the question and receiving an answer
  const answer = followUp[0]; // Placeholder for actual user interaction

  return { answer };
};