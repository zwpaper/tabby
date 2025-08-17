import type { McpToolStatus } from "@getpochi/common/vscode-webui-bridge";
import type { ToolCallOptions } from "ai";

interface McpServerTransportStdio {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

interface McpServerTransportHttp {
  url: string;
  headers?: Record<string, string>;
}

type McpServerTransport = McpServerTransportStdio | McpServerTransportHttp;

interface McpServerCustomization {
  disabled?: boolean;
  disabledTools?: string[];
}

export type McpServerConfig = McpServerTransport & McpServerCustomization;

export function isStdioTransport(
  config: McpServerTransport,
): config is McpServerTransportStdio {
  return "command" in config;
}

export function isHttpTransport(
  config: McpServerTransport,
): config is McpServerTransportHttp {
  return "url" in config && !("command" in config);
}

export interface McpToolExecutable {
  execute?(args: unknown, options: ToolCallOptions): Promise<unknown>;
}

export function isExecutable(
  tool: McpToolExecutable,
): tool is McpToolExecutable & {
  execute: (args: unknown, options?: ToolCallOptions) => Promise<unknown>;
} {
  return typeof tool?.execute === "function";
}

export function omitDisabled<T extends McpToolStatus>(
  tool: T,
): Omit<T, "disabled"> {
  const { disabled, ...rest } = tool;
  return rest;
}
