import { type Kysely, } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema.dropIndex("task_lock_updated_at_index").ifExists().execute();
  await db.schema.dropTable("taskLock").ifExists().execute();
}

export async function down(_db: Kysely<any>) {
}

