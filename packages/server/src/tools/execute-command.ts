import { tool } from 'ai';
import { z } from "zod";

export const executeCommand = tool({
    description: "Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task.",
    parameters: z.object({
        command: z.string().describe("The CLI command to execute. This should be valid for the current operating system."),
        cwd: z.string().optional().describe("The working directory to execute the command in."),
    }),
});