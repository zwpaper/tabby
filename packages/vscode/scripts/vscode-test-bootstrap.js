import "reflect-metadata"; // Required for tsyringe
import tsConfigPaths from "tsconfig-paths";

tsConfigPaths.register({
  baseUrl: "./",
  paths: {
    "@/*": ["./out/*"],
  },
});
