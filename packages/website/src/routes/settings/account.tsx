import { SettingsCards } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/account")({
  component: Account,
});

function Account() {
  return (
    <>
      <SettingsCards
        classNames={{
          base: "mx-auto max-w-2xl",
          card: {
            avatar: {
              base: "mr-2",
              image: "max-w-[64px]",
            },
            cell: "py-2",
          },
        }}
      />
    </>
  );
}
