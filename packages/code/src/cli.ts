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
  .parse(process.argv);

const config = program.opts();

const appConfig = {
  dev: config.dev || false,
  prompt: config.prompt,
};

app(appConfig);
