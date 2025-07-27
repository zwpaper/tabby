import { describe, it, expect } from "vitest";
import { parseTitle } from "../message-utils";

describe("message-utils", () => {
  describe("toUIMessageTitle", () => {
    it("should return the correct ui title with workflow", () => {
      const rawTitle: string = '<workflow id="test" path="test">test\nworkflow</workflow> rest';
      const expectedTitle: string = "/test rest";
      const result = parseTitle(rawTitle);
      expect(result).toEqual(expectedTitle);
    });

    it("should return the correct ui title with file", () => {
      const rawTitle: string = "<file>/path/to/file</file> rest";
      const expectedTitle: string = "/path/to/file rest";
      const result = parseTitle(rawTitle);
      expect(result).toEqual(expectedTitle);
    });
  });
});
