import { promises as fs } from "node:fs";
import * as path from "node:path";
import { FileMigrationProvider, Migrator } from "kysely";
import { db } from "../src/db";

async function migrate(direction: "up" | "down" | "latest" | "reset") {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // This needs to be an absolute path.
      migrationFolder: path.join(__dirname, "../migrations"),
    }),
  });

  console.log(`Migrating ${direction}...`);

  let error: any;
  let results: any;

  if (direction === "latest") {
    ({ error, results } = await migrator.migrateToLatest());
  } else if (direction === "up") {
    ({ error, results } = await migrator.migrateUp());
  } else if (direction === "down") {
    ({ error, results } = await migrator.migrateDown());
  } else if (direction === "reset") {
    // For reset, first run all down migrations
    console.log("Resetting database - running all down migrations...");
    let downResults: any[] = [];
    
    // Keep migrating down until no more migrations can be applied
    let downResult;
    do {
      downResult = await migrator.migrateDown();
      if (downResult.results && downResult.results.length > 0) {
        downResults = [...downResults, ...downResult.results];
      }
      if (downResult.error) {
        error = downResult.error;
        break;
      }
    } while (downResult.results && downResult.results.length > 0);
    
    if (!error) {
      // Then run all up migrations
      console.log("Running all up migrations...");
      const upResult = await migrator.migrateToLatest();
      error = upResult.error;
      results = [...downResults, ...(upResult.results || [])];
    }
  } else {
    console.error(`Invalid direction: ${direction}`);
    process.exit(1);
  }

  for (const it of results ?? []) {
    if (it.status === "Success") {
      console.log(
        `migration "${it.migrationName}" was executed successfully (${it.direction})`,
      );
    } else if (it.status === "Error") {
      console.error(
        `failed to execute migration "${it.migrationName}" (${it.direction})`,
      );
    }
  }

  if (error) {
    console.error(`failed to migrate ${direction}`);
    console.error(error);
    process.exit(1);
  } else if (results?.length === 0) {
    console.log("No migrations to run.");
  }

  await db.destroy();
}

const directionArg = process.argv[2] ?? "latest";

if (
  directionArg !== "up" &&
  directionArg !== "down" &&
  directionArg !== "latest" &&
  directionArg !== "reset"
) {
  console.error(
    `Invalid direction argument: ${directionArg}. Must be 'up', 'down', 'latest', or 'reset'.`,
  );
  process.exit(1);
}

migrate(directionArg as "up" | "down" | "latest" | "reset");
