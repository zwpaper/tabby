export interface McpAppConfig {
  name: string;
  description: string;
  paths: {
    darwin?: string[];
    linux?: string[];
    win32?: string[];
  };
}

export interface McpConfigPath {
  name: string;
  path: string;
  description: string;
}

export const McpAppConfigs: McpAppConfig[] = [
  {
    name: "Cursor",
    description: "Cursor MCP configuration",
    paths: {
      darwin: ["~", ".cursor", "mcp.json"],
      linux: ["~", ".cursor", "mcp.json"],
      win32: ["%USERPROFILE%", ".cursor", "mcp.json"],
    },
  },
  {
    name: "Cline",
    description: "Cline MCP configuration",
    paths: {
      darwin: [
        "~",
        "Library",
        "Application Support",
        "Code",
        "User",
        "globalStorage",
        "saoudrizwan.claude-dev",
        "settings",
        "cline_mcp_settings.json",
      ],
      linux: [
        "~",
        ".config",
        "Code",
        "User",
        "globalStorage",
        "saoudrizwan.claude-dev",
        "settings",
        "cline_mcp_settings.json",
      ],
      win32: [
        "%APPDATA%",
        "Code",
        "User",
        "globalStorage",
        "saoudrizwan.claude-dev",
        "settings",
        "cline_mcp_settings.json",
      ],
    },
  },
  {
    name: "Roo Code",
    description: "Roo Code MCP configuration",
    paths: {
      darwin: [
        "~",
        "Library",
        "Application Support",
        "Code",
        "User",
        "globalStorage",
        "rooveterinaryinc.roo-cline",
        "settings",
        "mcp_settings.json",
      ],
      linux: [
        "~",
        ".config",
        "Code",
        "User",
        "globalStorage",
        "rooveterinaryinc.roo-cline",
        "settings",
        "mcp_settings.json",
      ],
      win32: [
        "%APPDATA%",
        "Code",
        "User",
        "globalStorage",
        "rooveterinaryinc.roo-cline",
        "settings",
        "mcp_settings.json",
      ],
    },
  },
  {
    name: "Claude Desktop",
    description: "Claude Desktop MCP configuration",
    paths: {
      darwin: [
        "~",
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json",
      ],
      linux: ["~", ".config", "Claude", "claude_desktop_config.json"],
      win32: ["%APPDATA%", "Claude", "claude_desktop_config.json"],
    },
  },
];
