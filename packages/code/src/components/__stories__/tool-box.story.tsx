import type {
  ExecuteCommandOutputType,
  SearchFilesOutputType,
} from "@ragdoll/tools";
import type { ToolInvocation } from "ai";
import ToolBox from "../tool-box";

function makeToolCall(
  toolName: string,
  args: any,
  result?: any,
  state: "call" | "result" = "call",
): ToolInvocation {
  if (state === "call" || result === undefined) {
    return {
      toolCallId: Math.random().toString(36).substring(7),
      state: "call",
      toolName,
      args,
    };
  }
  return {
    toolCallId: Math.random().toString(36).substring(7),
    state: "result",
    toolName,
    args,
    result,
  };
}

function addToolResult() {}

const longContent = `Line 1: This is the first line of a long file content.
Line 2: It demonstrates the collapsible feature.
Line 3: When content exceeds 5 lines, it should be hidden by default.
Line 4: Users can click to expand and see the full content.
Line 5: This helps keep the UI clean for large file writes.
Line 6: This is the sixth line, ensuring it triggers the collapse.
Line 7: Another line just to be sure.
`;

const longCommandOutput = `total 128
drwxr-xr-x@ 19 user staff 608 Mar 28 11:09 .
drwxr-xr-x 4 user staff 128 Mar 27 15:30 ..
-rw-r--r--@ 1 user staff 1084 Mar 27 15:30 README.md
-rw-r--r-- 1 user staff 283 Mar 28 10:58 package.json
drwxr-xr-x@ 3 user staff 96 Mar 27 15:30 src
drwxr-xr-x 3 user staff 96 Mar 27 15:30 storybook
-rw-r--r-- 1 user staff 635 Mar 27 15:30 tsconfig.json
-rw-r--r-- 1 user staff 4500 Mar 28 10:58 node_modules/.vite/deps/chunk-5P4F4F6C.js
-rw-r--r-- 1 user staff 1234 Mar 28 10:58 node_modules/.vite/deps/chunk-ABCDEF12.js
-rw-r--r-- 1 user staff 5678 Mar 28 10:58 node_modules/.vite/deps/chunk-GHIJKL34.js
-rw-r--r-- 1 user staff 9101 Mar 28 10:58 node_modules/.vite/deps/chunk-MNOPQR56.js
-rw-r--r-- 1 user staff 1121 Mar 28 10:58 node_modules/.vite/deps/chunk-STUVWX78.js
-rw-r--r-- 1 user staff 3141 Mar 28 10:58 node_modules/.vite/deps/chunk-YZ123490.js
`;

const longErrorMessage = `Error: Failed to execute command 'cat non_existent_file'.
Details: cat: non_existent_file: No such file or directory
Stack Trace:
  at ChildProcess.exithandler (node:child_process:422:12)
  at ChildProcess.emit (node:events:518:28)
  at maybeClose (node:internal/child_process:1105:16)
  at Socket.<anonymous> (node:internal/child_process:457:11)
  at Socket.emit (node:events:518:28)
  at Pipe.<anonymous> (node:net:345:12)
  at Pipe.callbackTrampoline (node:internal/async_hooks:130:17)
This is an additional line to make the error message longer.
And another one to ensure it exceeds the collapse threshold.
Yet another line for good measure.
Final extra line to demonstrate the collapsing behavior clearly.
`;

const searchResults: Exclude<
  SearchFilesOutputType,
  { error: string }
>["matches"] = [
  {
    file: "src/components/tool-box.tsx",
    line: 42,
    context: "const ToolBox: React.FC<",
  },
  {
    file: "src/components/tool-box.tsx",
    line: 55,
    context: "  const C = ToolComponents[toolCall.toolName] || DefaultTool;",
  },
  {
    file: "src/components/__stories__/tool-box.story.tsx",
    line: 5,
    context: 'import ToolBox from "../tool-box";',
  },
  {
    file: "src/components/__stories__/tool-box.story.tsx",
    line: 45,
    context:
      '      component: <ToolBox toolCall={makeToolCall("listFiles", { path: ".", recursive: true }, { files: ["README.md", "package.json"] })} addToolResult={addToolResult} />',
  },
  {
    file: "src/index.tsx",
    line: 10,
    context: 'import ToolBox from "./components/tool-box";',
  },
  {
    file: "src/tools/search-files.ts",
    line: 15,
    context: '    const content = buffer.toString("utf-8");',
  },
];

const storyExport = {
  stories: [
    // --- List Files ---
    {
      id: "listFilesRecursiveResult",
      title: "List Files (Recursive, Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "listFiles",
            { path: ".", recursive: true },
            {
              files: [
                "README.md",
                "package.json",
                "tsconfig.json",
                "src/index.tsx",
                "src/tools/execute-command.ts",
                "src/tools/search-files.ts",
                "src/components/tool-box.tsx",
                "src/components/__stories__/tool-box.story.tsx",
              ],
              isTruncated: false,
            },
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "listFilesNonRecursiveResult",
      title: "List Files (Non-Recursive, Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "listFiles",
            { path: "src", recursive: false },
            {
              files: ["src/index.tsx", "src/tools", "src/components"],
              isTruncated: false,
            },
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    // --- Read File ---
    {
      id: "readFileResult",
      title: "Read File (Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "readFile",
            { path: "src/example.txt", startLine: 10, endLine: 20 },
            {
              content: "This is the content read from lines 10 to 20.",
              isTruncated: false,
            },
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    // --- Apply Diff ---
    {
      id: "applyDiffCall",
      title: "Apply Diff (Call)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "applyDiff",
            {
              path: "/root/abc",
              startLine: 1,
              endLine: 5,
              diff: "<<<<<<< SEARCH\noriginal content line 1\noriginal content line 2\n=======\nnew content line 1\nnew content line 2\n>>>>>>> REPLACE",
            },
            undefined,
            "call",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "applyDiffResult",
      title: "Apply Diff (Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "applyDiff",
            {
              path: "/root/abc",
              startLine: 10,
              endLine: 12,
              diff: "<<<<<<< SEARCH\nOLD LINE 10\nOLD LINE 11\nOLD LINE 12\n=======\nNEW LINE 10\nNEW LINE 11\n>>>>>>> REPLACE",
            },
            { success: true },
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    // --- Write To File ---
    {
      id: "writeToFileResult",
      title: "Write To File (Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "writeToFile",
            {
              path: "new-file.txt",
              content: "Short content.",
            },
            { success: true },
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "writeToFileCollapsedResult",
      title: "Write To File (Collapsed, Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "writeToFile",
            { path: "long-file.txt", content: longContent },
            { success: true },
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    // --- Ask Follow-up Question ---
    {
      id: "askFollowupQuestion",
      title: "Ask Follow-up Question",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "askFollowupQuestion",
            {
              question: "What is the name of the main file?",
              followUp: ["app.js", "index.js", "main.py"],
            },
            undefined, // No result for this tool
            "call", // Always in 'call' state visually
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    // --- Execute Command ---
    {
      id: "executeCommandCall",
      title: "Execute Command (Call)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "executeCommand",
            { command: "npm install", cwd: "../backend" },
            undefined,
            "call",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "executeCommandSuccessResult",
      title: "Execute Command (Success, Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "executeCommand",
            { command: "echo 'Success!'" },
            { output: "Success!\n" } as ExecuteCommandOutputType,
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "executeCommandFailureResult",
      title: "Execute Command (Failure, Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "executeCommand",
            { command: "cat non_existent_file" },
            {
              output: "cat: non_existent_file: No such file or directory\n",
            } as ExecuteCommandOutputType,
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "executeCommandLongOutputResult",
      title: "Execute Command (Long Output, Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "executeCommand",
            { command: "ls -la /", cwd: "/" },
            {
              output: longCommandOutput,
            } as ExecuteCommandOutputType,
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    // --- Search Files ---
    {
      id: "searchFilesCall",
      title: "Search Files (Call)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "searchFiles",
            { path: "src", regex: "ToolBox", filePattern: "*.tsx" },
            undefined,
            "call",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "searchFilesResult",
      title: "Search Files (Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "searchFiles",
            { path: "src", regex: "consts+w+s*=s*" },
            { matches: searchResults.slice(0, 3) } as SearchFilesOutputType,
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "searchFilesNoMatchesResult",
      title: "Search Files (No Matches, Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "searchFiles",
            { path: ".", regex: "xyz123__nomatch__abc" },
            { matches: [] } as SearchFilesOutputType,
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "searchFilesCollapsedResult",
      title: "Search Files (Collapsed, Result)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "searchFiles",
            { path: "src", regex: "import" },
            { matches: searchResults } as SearchFilesOutputType, // Use all results
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    // --- Attempt Completion ---
    {
      id: "attemptCompletion",
      title: "Attempt Completion",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "attemptCompletion",
            {
              result: "Task completed successfully. All files updated.",
              command: "npm run build && npm start",
            },
            undefined, // No result for this tool
            "call", // Always in 'call' state visually
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    // --- Tool Error ---
    {
      id: "toolErrorShort",
      title: "Tool Error (Short Message)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "readFile",
            { path: "non-existent-file.txt" },
            { error: "File not found." },
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
    {
      id: "toolErrorLong",
      title: "Tool Error (Long Message)",
      component: (
        <ToolBox
          toolCall={makeToolCall(
            "executeCommand",
            { command: "cat non_existent_file" },
            { error: longErrorMessage },
            "result",
          )}
          addToolResult={addToolResult}
        />
      ),
    },
  ],
  meta: {
    group: "ToolBox",
    order: 2,
  },
};

export default storyExport;
