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

export function languageIdFromExtension(extension: string): string | undefined {
  return extensionToLanguageId[extension.toLowerCase()];
}

export function isKnownProgrammingLanguage(path: string): boolean {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (!extension) return false;
  return extension in extensionToLanguageId;
}

export const getFileExtension = (path: string): string => {
  const fileName = path.split("/").pop() || "";
  const extension = fileName.split(".").pop() || "";
  return extension.toLowerCase();
};
