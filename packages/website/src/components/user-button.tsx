import { useSession } from "@/lib/auth-hooks";
import { UserButton as UserButtonImpl } from "@daveyplate/better-auth-ui";
import { CircleStopIcon, ShieldUser } from "lucide-react";
import type React from "react";
import { merge } from "remeda";

export function UserButton({
  classNames = {},
  ...props
}: React.ComponentProps<typeof UserButtonImpl>) {
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

  if (props.size === "icon") {
    classNames = merge(
      {
        base: "border-2",
        trigger: {
          avatar: {
            base: "transition-transform duration-300 hover:scale-110 hover:rotate-3",
          },
        },
      },
      classNames,
    );
  }
  return (
    <UserButtonImpl
      classNames={classNames}
      {...props}
      additionalLinks={additionalLinks}
    />
  );
}
