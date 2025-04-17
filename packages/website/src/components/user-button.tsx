import { useSession } from "@/lib/auth-hooks";
import { UserButton as UserButtonImpl } from "@daveyplate/better-auth-ui";
import { CircleStopIcon, ShieldUser } from "lucide-react";
import type React from "react";

export function UserButton(props: React.ComponentProps<typeof UserButtonImpl>) {
  const { data: auth } = useSession();
  const { additionalLinks = [] } = props;
  if (auth?.session.impersonatedBy) {
    additionalLinks.push({
      href: "/stop-impersonating",
      label: "Stop impersonating",
      icon: <CircleStopIcon />,
    });
  }
  if (auth?.user.role === "admin") {
    additionalLinks.push({
      href: "/admin",
      label: "Admin",
      icon: <ShieldUser />,
    });
  }
  return <UserButtonImpl {...props} additionalLinks={additionalLinks} />;
}
