import { describe, it, expect } from "vitest";
import { getWorkflowPath } from "../workflow";

describe("getWorkflowPath", () => {
  it("should return correct workflow file path", () => {
    expect(getWorkflowPath("my-workflow")).toBe(".pochi/workflows/my-workflow.md");
    expect(getWorkflowPath("test_workflow")).toBe(".pochi/workflows/test_workflow.md");
    expect(getWorkflowPath("workflow123")).toBe(".pochi/workflows/workflow123.md");
  });

  it("should handle single character names", () => {
    expect(getWorkflowPath("a")).toBe(".pochi/workflows/a.md");
    expect(getWorkflowPath("1")).toBe(".pochi/workflows/1.md");
  });
});