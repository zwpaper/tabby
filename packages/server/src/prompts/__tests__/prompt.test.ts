import { test, expect } from "bun:test";
import { generateSystemPrompt } from "..";

test("snapshot", () => {
    expect(generateSystemPrompt()).toMatchSnapshot()
});