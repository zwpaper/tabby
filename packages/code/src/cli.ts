import { parseArgs } from "node:util";
import { app } from ".";

const { values: config } = parseArgs({
  args: Bun.argv,
  options: {
    dev: {
      type: "boolean",
    },
  },
  strict: true,
  allowPositionals: true,
});

app(config);
