import { APIKeysCard, AccountSettingsCards } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_base/_settings/account")(
  {
    component: Account,
  },
);

function Account() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <AccountSettingsCards />
      <APIKeysCard prefix="pk_" />
    </div>
  );
}
