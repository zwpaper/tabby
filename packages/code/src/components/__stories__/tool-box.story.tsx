import type { ToolInvocation } from "ai";
import ToolBox from "../tool-box";

function makeToolCall(
  toolName: string,
  args: any,
  result?: any,
): ToolInvocation {
  if (result === undefined) {
    return {
      toolCallId: "0",
      state: "call",
      toolName,
      args,
    };
  } else {
    return {
      toolCallId: "0",
      state: "result",
      toolName,
      args,
      result,
    };
  }
}

function addToolResult() {}

const storyExport = {
  stories: [
    {
      id: "listFiles",
      title: "List Files",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "listFiles",
            {
              path: ".",
              recursive: true,
            },
            {
              files: [
                "README.md",
                "package.json",
                "tsconfig.json",
                "src/index.tsx",
                "src/tools/execute-command.ts",
                "src/tools/search-files.ts",
                "src/tools/apply-diff.ts",
                "src/tools/read-file.ts",
                "src/tools/constants.ts",
                "src/tools/list-files.ts",
                "src/tools/index.ts",
                "src/tools/write-to-file.ts",
                "src/tools/file-utils.ts",
                "src/components/markdown.tsx",
                "src/components/tool-box.tsx",
                "src/components/chat.tsx",
                "src/components/collapsible.tsx",
                "src/tools/__tests__/execute-command.test.ts",
                "src/tools/__tests__/list-files.test.ts",
                "src/tools/__tests__/file-utils.test.ts",
                "src/tools/__tests__/write-to-file.test.ts",
                "src/tools/__tests__/read-file.test.ts",
                "src/tools/__tests__/apply-diff.test.ts",
                "src/tools/__tests__/search-files.test.ts",
                "src/components/__stories__/tool-box.story.tsx",
                "src/components/__stories__/playground.story.tsx",
              ],
            },
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "applyDiffWithResult",
      title: "Apply Diff (With Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "applyDiff",
            {
              path: "/root/abc",
              diff: `THIS IS PATCH CONTENT
THIS IS PATCH CONTENT
THIS IS PATCH CONTENT
THIS IS PATCH CONTENT
THIS IS PATCH CONTENT
THIS IS PATCH CONTENT
THIS IS PATCH CONTENT`,
            },
            true,
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "attemptCompletion",
      title: "Attempt Completion",
      component: (
        <ToolBox
          toolCall={makeToolCall("attemptCompletion", {
            result: "this is result",
            command: "this is command",
          })}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "placeholder",
      title: "Placeholder",
      component: <></>,
    },
  ],
  meta: {
    group: "ToolBox",
    order: 1,
  },
};

export default storyExport;
