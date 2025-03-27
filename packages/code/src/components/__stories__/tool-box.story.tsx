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
      id: "applyDiff",
      title: "Apply Diff",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "applyDiff",
            {
              diff: "THIS IS PATCH CONTENT",
            },
            {
              error: "Failed to define",
            },
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "writeToFile",
      title: "WriteToFile",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "writeToFile",
            {
              path: "/foo/bar",
              content: "def",
            },
            {
              error: "/foo/bar doesn't exists",
            },
          )}
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
