import { Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("task")
    .addColumn("clientTaskId", "text")
    .execute();

  await db.schema.createIndex("task_user_client_task_id_idx")
    .on("task")
    .columns(["userId", "clientTaskId"])
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("task_user_client_task_id_idx").execute();
  await db.schema
    .alterTable("task")
    .dropColumn("clientTaskId")
    .execute();
}
