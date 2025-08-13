import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("task").dropConstraint("task_userId_taskId_unique").execute();
}

export async function down(_db: Kysely<any>): Promise<void> {
}
