import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .alterTable("task")
    .addColumn("statusMigrate", "text", (col) => col.notNull().defaultTo("pending-input"))
    .execute();

  await sql`UPDATE task SET "statusMigrate" = status`.execute(db);
}

export async function down(db: Kysely<any>) {
  await db.schema.alterTable("task").dropColumn('statusMigrate').execute();
}
