import { describe, expect, it } from "bun:test";
import app from "../server";

describe("My first test", () => {
  it("Should return 200 Response", async () => {
    const req = new Request("http://localhost:4111/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Hello World",
          },
        ],
      }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });
});
