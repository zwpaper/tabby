import { sql } from "kysely";
import type { SelectQueryBuilder } from "kysely";

export function parseEventFilter(
  val?: string,
): Record<string, unknown> | undefined {
  if (!val) return undefined;

  try {
    return JSON.parse(val);
  } catch {
    return undefined;
  }
}

export function applyEventFilter<DB, TB extends keyof DB, O>(
  query: SelectQueryBuilder<DB, TB, O>,
  eventFilter?: Record<string, unknown>,
): SelectQueryBuilder<DB, TB, O> {
  if (!eventFilter) {
    return query;
  }

  return query.where(sql`event`, "@>", eventFilter);
}
