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
        files: ["index.ts", "package.json"],
        isTruncated: false,
      },
      info: {
        cwd: "/home/user/project",
        os: "linux",
        homedir: "/home/user",
        shell: "bash",
      },
    }, {
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
      }
    }),
  ).toMatchSnapshot();
});
