import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('minion').dropColumn('e2bSandboxId').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('minion')
    .addColumn('e2bSandboxId', 'text')
    .execute();
}

