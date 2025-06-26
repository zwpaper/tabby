import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Make e2bSandboxId nullable, also deprecated, will be replaced by sandboxId
  await db.schema
    .alterTable('minion')
    .alterColumn('e2bSandboxId', col => col.dropNotNull())
    .execute()

  await db.schema
    .alterTable('minion')
    .alterColumn('url', col => col.dropNotNull())
    .execute()

  await db.schema
    .alterTable('minion')
    .addColumn('sandboxId', 'text')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('minion')
    .dropColumn('sandboxId')
    .execute()

  // Make url not null again (note: this might fail if there are null values)
  await db.schema
    .alterTable('minion')
    .alterColumn('url', col => col.setNotNull())
    .execute()

  // Make e2bSandboxId not null again (note: this might fail if there are null values)
  await db.schema
    .alterTable('minion')
    .alterColumn('e2bSandboxId', col => col.setNotNull())
    .execute()
}
