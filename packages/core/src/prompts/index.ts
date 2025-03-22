import { getSharedToolUseSection } from "./sections/tool-use";

export async function generatePrompt(): Promise<string> {
    const basePrompt = `You are Tabby, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.

${getSharedToolUseSection()}
`;

    return basePrompt
}