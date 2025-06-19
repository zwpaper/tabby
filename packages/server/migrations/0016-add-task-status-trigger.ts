import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION task_status_channel()
    RETURNS TRIGGER AS $$
    BEGIN
      PERFORM pg_notify('task_status_channel', json_build_object('id', NEW.id, 'status', NEW.status, 'userId', NEW."userId")::text);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db)

  await sql`
    CREATE TRIGGER task_status_channel_trigger
    AFTER INSERT OR UPDATE OF status ON task
    FOR EACH ROW
    EXECUTE FUNCTION task_status_channel();
  `.execute(db)

}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS task_status_channel_trigger ON task;
  `.execute(db)
  await sql`
    DROP FUNCTION IF EXISTS task_status_channel();
  `.execute(db)
}


