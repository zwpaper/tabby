import { simulateReadableStream } from "ai";
import { MockLanguageModelV1 } from "ai/test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import chatImpl, { type ContextVariables } from "../chat";

function getAppWithMockModel() {
  const app = new Hono<{ Variables: ContextVariables }>();
  app
    .use(async (c, next) => {
      c.set(
        "model",
        new MockLanguageModelV1({
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: "text-delta", textDelta: "Hello" },
                { type: "text-delta", textDelta: ", " },
                { type: "text-delta", textDelta: "world!" },
                {
                  type: "finish",
                  finishReason: "stop",
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        }),
      );
      await next();
    })
    .route("/", chatImpl);

  return app;
}

describe("My first test", () => {
  it("Should return 200 Response", async () => {
    const req = new Request("http://localhost:4111/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: "0",
        messages: [
          {
            role: "user",
            content: "Hello World",
          },
        ],
      }),
    });
    const app = getAppWithMockModel();
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });
});
