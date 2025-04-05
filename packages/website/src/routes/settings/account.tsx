import { SettingsCards } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/account")({
  component: Account,
});

function Account() {
  return (
    <SettingsCards
      classNames={{
        base: "max-w-2xl",
      }}
    />
  );
}
