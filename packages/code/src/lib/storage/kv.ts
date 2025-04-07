import Database from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const sqliteName = path.join(
  process.env.HOME || "",
  ".ragdoll",
  "data",
  "db.sqlite",
);

export class KV {
  readonly #database: Database;
  readonly #table: string;
  #select;
  #set;
  #watchers: Map<string, Set<(value: string) => void>>;

  constructor(dbName: string) {
    mkdirSync(path.dirname(sqliteName), { recursive: true });
    this.#database = new Database(sqliteName, {
      create: true,
      readwrite: true,
    });
    this.#database.exec(
      "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
    );
    this.#table = dbName.replace(/[^a-zA-Z0-9_]/g, "_");
    this.#database
      .prepare(
        `
			CREATE TABLE IF NOT EXISTS ${this.#table} (
				key TEXT NOT NULL PRIMARY KEY,
				value TEXT NOT NULL
			) WITHOUT ROWID;
		`,
      )
      .run();
    this.#select = this.#database.query(
      `SELECT value FROM ${this.#table} WHERE key = $key`,
    );
    this.#set = this.#database.query(
      `INSERT OR REPLACE INTO ${this.#table} (key, value) VALUES ($key, $value)`,
    );
    this.#watchers = new Map();
  }

  getItem(key: string) {
    const row = this.#select.get(key) as { value: string } | null;
    return row?.value || null;
  }

  setItem(key: string, value: string) {
    this.#set.run(key, value);
    const watchers = this.#watchers.get(key);
    if (watchers) {
      for (const callback of watchers) {
        callback(value);
      }
    }
  }

  watchItem(key: string, callback: (value: string) => void) {
    if (!this.#watchers.has(key)) {
      this.#watchers.set(key, new Set());
    }
    this.#watchers.get(key)?.add(callback);
  }

  unwatchItem(key: string, callback: (value: string) => void) {
    const watchers = this.#watchers.get(key);
    if (watchers) {
      watchers.delete(callback);
      if (watchers.size === 0) {
        this.#watchers.delete(key);
      }
    }
  }
}
