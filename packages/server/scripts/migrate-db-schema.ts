import { promises as fs } from "node:fs";
import * as path from "node:path";
import { FileMigrationProvider, Migrator } from "kysely";
import { db } from "../src/db";

async function migrate(direction: "up" | "down" | "latest") {
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
  directionArg !== "latest"
) {
  console.error(
    `Invalid direction argument: ${directionArg}. Must be 'up', 'down', or 'latest'.`,
  );
  process.exit(1);
}

migrate(directionArg as "up" | "down" | "latest");
