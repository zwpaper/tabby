import { useSession } from "@/lib/auth-hooks";
import { cn } from "@/lib/utils";
import {
  UserAvatar,
  UserButton as UserButtonImpl,
} from "@daveyplate/better-auth-ui";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { CircleStopIcon, ShieldUser } from "lucide-react";
import type React from "react";
import { type MouseEventHandler, useCallback } from "react";
import { merge } from "remeda";
import { Button } from "./ui/button";

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

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();

      navigate({
        to: "/profile",
      });
    },
    [navigate],
  );

  if (pathname !== "/profile") {
    return (
      <Button
        size="icon"
        className={cn("size-fit rounded-full")}
        variant="ghost"
        onClick={onClick}
      >
        <UserAvatar
          user={auth?.user}
          className={classNames?.base}
          classNames={classNames.trigger?.avatar}
        />
      </Button>
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
