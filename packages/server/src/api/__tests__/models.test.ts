import { describe, expect, it } from "vitest";
import models from "../models";

describe("GET /models", () => {
  it("Should return a list of available models", async () => {
    const req = new Request("http://localhost:4111/", {
      method: "GET",
    });
    const res = await models.fetch(req);
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
