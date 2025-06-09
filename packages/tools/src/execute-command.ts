import { z } from "zod";
import { defineClientTool } from "./types";

export const executeCommand = defineClientTool({
  description:
    `Executes a given bash command in a persistent shell session, ensuring proper handling and security measures.

Before executing the command, please follow these steps:

1. Directory Verification:
   - If the command will create new directories or files, first use the listFiles tool to verify the parent directory exists and is the correct location
   - For example, before running "mkdir foo/bar", first use listFiles to check that "foo" exists and is the intended parent directory

2. Command Execution:
   - After ensuring proper quoting, execute the command.
   - Capture the output of the command.

Usage notes:
- The command argument is required.
- If the output exceeds 30000 characters, output will be truncated before being returned to you.
- When issuing multiple commands, use the ';' or '&&' operator to separate them. DO NOT use newlines (newlines are ok in quoted strings).
- In order to ensure good formatting, ALWAYS pass the multi-line argument via a HEREDOC, a la this example:
<example>
git commit -m "$(cat <<'EOF'
   Commit message here.

   🤖 Generated with [Pochi](https://getpochi.com)

   Co-Authored-By: Pochi <noreply@getpochi.com>
   EOF
   )"
</example>

Important:
- NEVER update the git config
- Return the PR URL when you're done, so the user can see it

# Other common operations
- Creating a Github PR
gh pr create --title "the pr title" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points>

## Test plan
[Checklist of TODOs for testing the pull request...]

🤖 Generated with [Pochi](https://getpochi.com)
EOF
)"
- View comments on a Github PR: gh api repos/foo/bar/pulls/123/comments`.trim(),
  inputSchema: z.object({
    command: z
      .string()
      .describe(
        "The CLI command to execute. This should be valid for the current operating system.",
      ),
    cwd: z
      .string()
      .optional()
      .describe("The working directory to execute the command in."),
    isDevServer: z
      .boolean()
      .optional()
      .describe(
        "Whether the command is being run as a development server, e.g. `npm run dev`.",
      ),
  }),
  outputSchema: z.object({
    output: z
      .string()
      .describe("The output of the command (including stdout and stderr)."),
    isTruncated: z
      .boolean()
      .optional()
      .describe("Whether the output was truncated"),
  }),
});
