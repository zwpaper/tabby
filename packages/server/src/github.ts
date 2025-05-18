import { sql } from "kysely";
import { type DB, db } from "./db";

export async function handleGithubAccountUpdate({
  userId,
  accountId,
  accessToken,
  scope,
}: {
  userId?: string | null;
  accountId?: string | null;
  accessToken?: string | null;
  scope?: string | null;
}) {
  if (!userId || !accountId || !accessToken || !scope) {
    return false;
  }
  if (!scope.includes("repo")) {
    return false;
  }
  const vendorData = JSON.stringify({
    provider: "github",
    integrationId: accountId,
    payload: {
      accessToken: accessToken,
      scopes: scope.split(","),
    },
  } satisfies DB["externalIntegration"]["vendorData"]["__select__"]);

  await db
    .insertInto("externalIntegration")
    .values({
      userId,
      vendorData,
    })
    .onConflict((oc) =>
      oc
        .expression(
          sql`("vendorData"->>'provider'), ("vendorData"->>'integrationId')`,
        )
        .doUpdateSet({
          userId,
          vendorData,
        }),
    )
    .execute();
  return true;
}
