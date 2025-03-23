import { expect, test } from "bun:test";
import { generateSystemPrompt } from "..";

test("snapshot", () => {
  expect(generateSystemPrompt()).toMatchSnapshot();
});
