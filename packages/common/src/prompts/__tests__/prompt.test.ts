import { expect, test } from "vitest";
import { getReadEnvironmentResult } from "../environment";
import { generateSystemPrompt } from "../system";

test("snapshot", () => {
  expect(
    generateSystemPrompt({
      cwd: "/home/user/project",
      os: "linux",
      homedir: "/home/user",
      shell: "bash",
      customRules: `# Rules from (abc)`,
    }),
  ).toMatchSnapshot();
});

test("environment", () => {
  expect(
    getReadEnvironmentResult({
        currentTime: "2021-01-01T00:00:00.000Z",
        workspace: {
          files: ["index.ts", "package.json", "tsconfig.json", "README.md"],
          isTruncated: false,
          activeTabs: ["README.md", "tsconfig.json", "package.json"],
          activeSelection: {
            filepath: "README.md",
            range: {
              start: {
                line: 2,
                character: 0,
              },
              end: {
                line: 4,
                character: 46,
              },
            },
            content:
              "This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.\n\nCurrently, two official plugins are available:",
          },
          gitStatus: {
            currentBranch: 'add-environment-to-chat-request-body',
            mainBranch: 'main',
            status: 'M packages/vscode-webui-bridge/src/index.ts\nA packages/vscode-webui/src/lib/use-environment.ts\nM packages/vscode-webui/src/lib/vscode.ts\nM packages/vscode-webui/src/routes/chat.tsx\n?? src/fib.test.ts\n?? vitest.config.ts',
            recentCommits: [
              '02b50f727 feat(chat): add environment property to prepareRequestBody',
              '962185adb feat(webui): add new task link and pending component',
            ],
          },
        },
        todos: [
          {
            content: "fix this",
            id: "1",
            status: "pending",
            priority: "high",
          },
        ],
        info: {
          cwd: "/home/user/project",
          os: "linux",
          homedir: "/home/user",
          shell: "bash",
      }},
      {
        type: "slack:message",
        data: {
          type: "message",
          subtype: "bot_message",
          event_ts: "1234567890.123456",
          user: "U12345678",
          text: "Hello, world!",
          ts: "1234567890.123456",
          channel: "C12345678",
          channel_type: "group",
          bot_id: "B12345678",
        },
      },
    ),
  ).toMatchSnapshot();
});

