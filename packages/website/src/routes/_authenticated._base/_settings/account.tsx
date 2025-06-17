import { AccountSettingsCards } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_base/_settings/account")(
  {
    component: Account,
  },
);

function Account() {
  return <AccountSettingsCards />;
}
