import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/lib/auth-client";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { Quota } from "../ui/quota";
import { Section } from "../ui/section";

interface AccountSectionProps {
  user: User;
}

export const AccountSection: React.FC<AccountSectionProps> = ({ user }) => {
  return (
    <Section title="" className="pt-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex flex-grow cursor-pointer items-center justify-between gap-3 rounded-md p-2 hover:bg-secondary">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback>
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold">
                  {user.name || `USER-${user.id}`}
                </span>
                {user.email && (
                  <span className="text-muted-foreground text-sm">
                    {user.email}
                  </span>
                )}
              </div>
            </div>
            <ChevronsUpDown className="size-5" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild className="cursor-pointer">
            <a
              href="command:ragdoll.logout"
              target="_blank"
              rel="noopener noreferrer"
            >
              <LogOut className="size-4" />
              Sign Out
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Quota />
    </Section>
  );
};
