import { expect, test } from "vitest";
import { generateSystemPrompt } from "..";

test("snapshot", () => {
  expect(generateSystemPrompt()).toMatchSnapshot();
});
