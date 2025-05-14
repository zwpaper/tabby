import type { Meta, StoryObj } from "@storybook/react";

import type { ToolProps } from "@/components/tool-invocation/types";
import type { ClientToolsType } from "@ragdoll/tools";
import { ToolsGallery } from "./ToolGallery";

const meta: Meta<typeof ToolsGallery> = {
  title: "Pochi/Tools",
  component: ToolsGallery,
};

export default meta;

type Story = StoryObj<typeof ToolsGallery>;
type SearchFilesProp = ToolProps<ClientToolsType["searchFiles"]>;
type ReadFileProp = ToolProps<ClientToolsType["readFile"]>;
type ApplyDiffProp = ToolProps<ClientToolsType["applyDiff"]>;
type ExecuteCommandProp = ToolProps<ClientToolsType["executeCommand"]>;
type ListFilesProp = ToolProps<ClientToolsType["listFiles"]>;
type GlobFilesProp = ToolProps<ClientToolsType["globFiles"]>;
type WriteToFileProp = ToolProps<ClientToolsType["writeToFile"]>;
type AskFollowupQuestionProp = ToolProps<
  ClientToolsType["askFollowupQuestion"]
>;
type AttemptCompletionProp = ToolProps<ClientToolsType["attemptCompletion"]>;

const searchProps: SearchFilesProp["tool"] = {
  args: {
    path: ".",
    regex: "index",
  },
  step: 0,
  state: "result",
  result: {
    matches: [
      {
        file: "src/nginx/Dockerfile",
        line: 11,
        context: "COPY index.html .",
      },
      {
        file: "readme.md",
        line: 17,
        context: "        index index.html;",
      },
      {
        file: "readme.md",
        line: 51,
        context: "        index index.html;",
      },
      {
        file: "src/nginx/nginx.conf",
        line: 46,
        context: "        index index.html;",
      },
    ],
    isTruncated: false,
  },
  toolName: "searchFiles",
  toolCallId: "toolu_vrtx_01Dr9irXJzSunZhGToswg4Qu",
};

const readProps: ReadFileProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "94sT2bTZIbHFwz7I",
  toolName: "readFile",
  args: {
    path: "README.md",
  },
  result: {
    content: " **04/17/2024** CodeGemma and CodeQwen mode",
    isTruncated: true,
  },
};

const applyDiffProps: ApplyDiffProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_apply_diff_1",
  toolName: "applyDiff",
  args: {
    path: "src/components/Button.tsx",
    diff: `--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,5 +1,5 @@
 interface ButtonProps {
-  text: string;
+  label: string;
   onClick: () => void;
 }`,
    startLine: 1,
    endLine: 5,
  },
  result: {
    success: true,
  },
};

const executeCommandProps: ExecuteCommandProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_exec_cmd_1",
  toolName: "executeCommand",
  args: {
    command: "npm run dev --port 3001",
    cwd: "/Users/annoy/github.com/TabbyML/ragdoll/packages/website",
    isDevServer: true,
  },
  result: {
    output: "Development server started on port 3001",
  },
};

const listFilesProps: ListFilesProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_list_files_1",
  toolName: "listFiles",
  args: {
    path: "src/components",
    recursive: false,
  },
  result: {
    files: ["Button.tsx", "Card.tsx", "Input.tsx"],
    isTruncated: false,
  },
};

const globFilesProps: GlobFilesProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_glob_files_1",
  toolName: "globFiles",
  args: {
    globPattern: "*.stories.tsx",
    path: "src/stories",
  },
  result: {
    files: ["Button.stories.tsx", "ToolGallery.stories.tsx"],
    isTruncated: false,
  },
};

const writeToFileProps: WriteToFileProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_write_file_1",
  toolName: "writeToFile",
  args: {
    path: "src/components/NewFeature.tsx",
    content: "export const NewFeature = () => <p>Amazing new feature!</p>;",
  },
  result: {
    success: true,
  },
};

const askFollowupQuestionProps: AskFollowupQuestionProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_ask_followup_1",
  toolName: "askFollowupQuestion",
  args: {
    question: "Which color theme would you like for the new button?",
    followUp: ["Primary", "Secondary", "Destructive"],
  },
  result: {
    success: true,
  },
};

const attemptCompletionProps: AttemptCompletionProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_attempt_completion_1",
  toolName: "attemptCompletion",
  args: {
    result:
      "The new Button component has been created and styled with the primary theme.",
    command: "git status",
  },
  result: {
    success: true,
  },
};

export const Tools: Story = {
  args: {
    tools: [
      searchProps,
      readProps,
      applyDiffProps,
      executeCommandProps,
      listFilesProps,
      globFilesProps,
      writeToFileProps,
      askFollowupQuestionProps,
      attemptCompletionProps,
    ],
  },
};
