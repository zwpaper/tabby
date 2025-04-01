import { simulateReadableStream } from "ai";
import { MockLanguageModelV1 } from "ai/test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { type ContextVariables, app as appImpl } from "../server";

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
    .route("/", appImpl);

  return app;
}

describe("My first test", () => {
  it("Should return 200 Response", async () => {
    const req = new Request("http://localhost:4111/api/chat/stream", {
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

describe("GET /api/models", () => {
  it("Should return a list of available models", async () => {
    const req = new Request("http://localhost:4111/api/models", {
      method: "GET",
    });
    const res = await appImpl.fetch(req);
    expect(res.status).toBe(200);

    const json: any = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    // Check the structure of the first model
    expect(json[0]).toHaveProperty("id");
    expect(json[0]).toHaveProperty("contextWindow");
    expect(typeof json[0].id).toBe("string");
    expect(typeof json[0].contextWindow).toBe("number");
  });
});
