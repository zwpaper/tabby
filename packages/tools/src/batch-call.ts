import { z } from "zod";

import { declareServerTool, defineClientToolV5 } from "./types";

export const BatchCallTools = [
  "applyDiff",
  "executeCommand",
  "globFiles",
  "listFiles",
  "newTask",
  "readFile",
  "searchFiles",
  "todoWrite",
  "webFetch",
  "writeToFile",
];

const toolDef = {
  description: `
- batchCall execution tool that runs multiple tool invocations in a single request
- Tools are executed in parallel
  * Avoid using batchCall for multiple git commands that modify the repository, as this can trigger git locking issues. Instead, use executeCommand with sequential commands like "git add src/foo.ts && git commit -m 'foo'" to ensure proper ordering
- Takes a list of tool invocations (toolName and input pairs)
- Returns the collected results from all invocations
- Use this tool when you need to run multiple independent tool operations at once -- it is awesome for speeding up your workflow, reducing both context usage and latency
- Each tool will respect its own permissions and validation rules
- You're only allowed to call following tools in batchCall: ${BatchCallTools.join(", ")}.

Example usage:
{
  "invocations": [
    {
      "toolName": "executeCommand",
      "args": {
        "command": "git blame src/foo.ts"
      }
    },
    {
      "toolName": "globFiles",
      "args": {
        "globPattern": "**/*.ts"
      }
    },
    {
      "toolName": "searchFiles",
      "input": {
        "regex": "function",
        "filePattern": "*.ts"
      }
    }
  ]
}
`.trim(),
  inputSchema: z.object({
    description: z
      .string()
      .describe("A short (3-5 word) description of the batch operation"),
    invocations: z
      .array(
        z.object({
          toolName: z.string().describe("The name of the tool to invoke"),
          args: z.any().describe("The input to pass to the tool"),
        }),
      )
      .min(1)
      .describe(
        "The list of tool invocations to execute (required -- you MUST provide at least one tool invocation)",
      ),
  }),
  outputSchema: z.object({
    success: z
      .boolean()
      .describe("Whether the batch operation was successful or not"),
  }),
};

export const batchCall = declareServerTool(toolDef);
export const batchCallV5 = defineClientToolV5(toolDef);
