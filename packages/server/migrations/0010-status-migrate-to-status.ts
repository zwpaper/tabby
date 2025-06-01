import { type Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema.alterTable("task").dropColumn('status').execute();
  await db.schema.dropType("task_status").ifExists().execute();
  await db.schema.alterTable("task").renameColumn("statusMigrate", "status").execute();

}

export async function down(_db: Kysely<any>) {
}
