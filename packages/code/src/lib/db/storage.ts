import Database from "bun:sqlite";

const sqliteName = "instantdb.sqlite";

export default class Storage {
  readonly #database: Database;
  readonly #table: string;
  #select;
  #set;

  constructor(dbName: string) {
    dbName = dbName.replace(/[^a-zA-Z0-9_]/g, "_");
    this.#database = new Database(sqliteName, {
      create: true,
      readwrite: true,
    });
    this.#database.exec(
      "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
    );
    this.#table = dbName;
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
  }

  async getItem(key: string) {
    const row = this.#select.get(key) as { value: string } | null;
    return row?.value || null;
  }

  async setItem(key: string, value: string) {
    this.#set.run(key, value);
  }
}
