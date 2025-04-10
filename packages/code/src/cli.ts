if (process.env.DEV === "true") {
  // HACK to make devtools work in bun.
  await import("../../../node_modules/ink/build/devtools-window-polyfill.js");
}

import { Command } from "commander";
import { version } from "../package.json";

function getVersion() {
  if (version.endsWith("-dev")) {
    return version + (process.env.INLINE_COMMIT_HASH || "");
  }

  return version;
}

const program = new Command();

program
  .name("pochi-code")
  .description("CLI for pochi-code")
  .version(getVersion());

program
  .option("--dev", "Run in development mode")
  .option("-p, --prompt <prompt>", "Initial prompt")
  .option("-a, --auto-approve", "Auto approve all tool calls")
  .option("--no-fullscreen", "Disable full screen mode")
  .option(
    "--projects-dir <directory>",
    "Projects directory (default: ~/PochiProjects)",
  )
  .option("--custom-rules <rules...>", "Custom rule files for the project")
  .parse(process.argv);

const config = program.opts();

const appConfig = {
  dev: config.dev || false,
  prompt: config.prompt,
  projectsDir: config.projectsDir,
  autoApprove: config.autoApprove || false,
  fullscreen: config.fullscreen === undefined ? true : config.fullscreen,
  customRuleFiles: config.customRules || [],
};

const { app } = await import("./app/page");
app(appConfig);
