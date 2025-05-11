import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createIndex("task_environment_info_idx")
    .on("task")
    .expression(sql`((environment->'info'))`)
    .using("gin")
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropIndex("task_environment_info_idx").ifExists().execute();
}

