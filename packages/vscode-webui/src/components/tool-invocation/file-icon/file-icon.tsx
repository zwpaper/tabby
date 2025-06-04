import { cn } from "@/lib/utils";
import { Folder } from "lucide-react";
import iconTheme from "./vs-seti-icon-theme.json";
import "./seti-icons.css";
import { type Theme, useTheme } from "@/components/theme-provider";

interface IconData {
  file: string;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  languageIds: Record<string, string>;
}

interface IconTheme extends IconData {
  iconDefinitions: Record<
    string,
    {
      fontCharacter: string;
      fontColor?: string;
    }
  >;
  light: IconData;
}

const typedIconTheme = iconTheme as unknown as IconTheme;

// Map common file extensions to their language IDs
const extensionToLanguageId: Record<string, string> = {
  // JavaScript family
  js: "javascript",
  jsx: "javascriptreact",
  ts: "typescript",
  tsx: "typescriptreact",
  mjs: "javascript",
  cjs: "javascript",
  // HTML family
  html: "html",
  htm: "html",
  // CSS family
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  // Markup/Markdown
  md: "markdown",
  markdown: "markdown",
  xml: "xml",
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  // Other common languages
  py: "python",
  rb: "ruby",
  php: "php",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  vue: "vue",
  svelte: "svelte",
  // Additional languages
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  dart: "dart",
  lua: "lua",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  sql: "sql",
  r: "r",
  clj: "clojure",
  scala: "scala",
  pl: "perl",
  pm: "perl",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hrl: "erlang",
  hs: "haskell",
  f: "fortran",
  f90: "fortran",
  groovy: "groovy",
  jl: "julia",
  m: "objective-c",
  mm: "objective-c",
  fs: "fsharp",
  fsx: "fsharp",
  toml: "toml",
};

const getFileExtension = (path: string): string => {
  const fileName = path.split("/").pop() || "";
  const extension = fileName.split(".").pop() || "";
  return extension.toLowerCase();
};

const getFileName = (path: string): string => {
  return path.split("/").pop() || "";
};

const getIconForFile = (path: string, theme: Theme = "dark"): string => {
  const fileName = getFileName(path);
  const extension = getFileExtension(path);
  const isLightTheme = theme === "light";

  const themeData: IconData = isLightTheme
    ? typedIconTheme.light
    : typedIconTheme;

  if (fileName && themeData.fileNames && themeData.fileNames[fileName]) {
    return themeData.fileNames[fileName];
  }

  if (
    extension &&
    themeData.fileExtensions &&
    themeData.fileExtensions[extension]
  ) {
    return themeData.fileExtensions[extension];
  }

  const languageId = extensionToLanguageId[extension];
  if (
    languageId &&
    themeData.languageIds &&
    themeData.languageIds[languageId]
  ) {
    return themeData.languageIds[languageId];
  }

  return typedIconTheme.file || "_default";
};

const File: React.FC<{
  path: string;
  theme: Theme;
  className?: string;
  defaultIconClassName?: string;
}> = ({ className, path, theme, defaultIconClassName }) => {
  const iconId = getIconForFile(path, theme);

  return (
    <span
      className={cn(className, "icon", `icon${iconId}`, "text-lg/4", {
        [defaultIconClassName ?? ""]: iconId === "_default",
      })}
      title={path}
      aria-label={`File: ${path}`}
    />
  );
};

export const FileIcon: React.FC<{
  path: string;
  className?: string;
  isDirectory?: boolean;
  defaultIconClassName?: string;
}> = ({ path, className, isDirectory = false, defaultIconClassName }) => {
  const { theme } = useTheme();
  return isDirectory ? (
    <Folder
      className={cn(
        "mx-0.5 inline size-3 w-[15px] text-blue-600 dark:text-blue-400",
        className,
      )}
    />
  ) : (
    <File
      className={className}
      path={path}
      theme={theme}
      defaultIconClassName={defaultIconClassName}
    />
  );
};
