import type { ToolFunctionType } from "@ragdoll/tools";
import type { Tool } from "ai";

// biome-ignore lint/suspicious/noExplicitAny: Type matching
type ReplaceReturnType<T extends (...a: any) => any, TNewReturn> = (
  ...a: Parameters<T>
) => TNewReturn;

export type PreviewToolFunctionType<T extends Tool> = ReplaceReturnType<
  ToolFunctionType<T>,
  void
>;
