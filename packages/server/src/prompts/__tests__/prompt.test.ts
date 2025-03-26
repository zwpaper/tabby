import { expect, test } from "vitest";
import { getReadEnvironmentResult } from "../environment";
import { generateSystemPrompt } from "../system";

test("snapshot", () => {
  expect(generateSystemPrompt()).toMatchSnapshot();
});

test("environment", () => {
  expect(
    getReadEnvironmentResult({
      currentTime: "2021-01-01T00:00:00.000Z",
      workspace: {
        files: ["index.ts", "package.json"],
        cwd: "/home/user/project",
        isTruncated: false,
      },
      info: {
        os: "linux",
        homedir: "/home/user",
        shell: "bash",
      }
    }),
  ).toMatchSnapshot();
});
