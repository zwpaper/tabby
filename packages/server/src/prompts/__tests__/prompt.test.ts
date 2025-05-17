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
    getReadEnvironmentResult(
      {
        currentTime: "2021-01-01T00:00:00.000Z",
        workspace: {
          files: ["index.ts", "package.json"],
          isTruncated: false,
        },
        info: {
          cwd: "/home/user/project",
          os: "linux",
          homedir: "/home/user",
          shell: "bash",
          gitStatus: `Current branch: add-environment-to-chat-request-body
Main branch (you will usually use this for PRs): main

Status:
M packages/vscode-webui-bridge/src/index.ts
A packages/vscode-webui/src/lib/use-environment.ts
M packages/vscode-webui/src/lib/vscode.ts
M packages/vscode-webui/src/routes/chat.tsx
?? src/fib.test.ts
?? vitest.config.ts

Recent commits:
02b50f727 feat(chat): add environment property to prepareRequestBody
962185adb feat(webui): add new task link and pending component`
        },
      },
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
