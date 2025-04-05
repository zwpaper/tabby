import { cn } from "@/lib/utils";
import { SettingsCards } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/account")({
  component: Account,
});

function Account() {
  const maxWidth = "max-w-2xl";
  return (
    <div className={cn("container mx-auto", maxWidth)}>
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <SettingsCards
        classNames={{
          base: cn("mx-auto mt-6", maxWidth),
        }}
      />
    </div>
  );
}
