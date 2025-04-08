import { Command } from "commander";
import { version } from "../package.json";
import { app } from "./app/page";

const program = new Command();

program
  .name("ragdoll-code")
  .description("CLI for ragdoll-code")
  .version(version);

program
  .option("--dev", "Run in development mode")
  .option("-p, --prompt <prompt>", "Initial prompt")
  .option("-a, --auto-approve", "Auto approve all tool calls")
  .option("--no-fullscreen", "Disable full screen mode")
  .option(
    "--projects-dir <directory>",
    "Projects directory (default: ~/RagdollProjects)",
  )
  .parse(process.argv);

const config = program.opts();

const appConfig = {
  dev: config.dev || false,
  prompt: config.prompt,
  projectsDir: config.projectsDir,
  autoApprove: config.autoApprove || false,
};

app(appConfig, !!config.fullscreen);
