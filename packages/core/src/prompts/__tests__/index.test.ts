import { expect, test } from "bun:test"
import { generatePrompt } from ".."

test("snapshot of generatePrompt", async () => {
    const prompt = await generatePrompt()
    expect(prompt).toMatchSnapshot()
})