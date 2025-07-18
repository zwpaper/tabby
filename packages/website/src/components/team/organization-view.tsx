import { cn } from "@/lib/utils";
import type { Organization } from "better-auth/plugins";
import { AiOutlineTeam } from "react-icons/ai";
import { Skeleton } from "../ui/skeleton";

interface OrganizationLogoClassNames {
  base?: string;
  image?: string;
  fallback?: string;
  fallbackIcon?: string;
  skeleton?: string;
}
interface OrganizationViewClassNames {
  base?: string;
  avatar?: OrganizationLogoClassNames;
  content?: string;
  title?: string;
  subtitle?: string;
  skeleton?: string;
}

interface OrganizationViewProps {
  className?: string;
  classNames?: OrganizationViewClassNames;
  isPending?: boolean;
  size?: "sm" | "default" | "lg" | null;
  organization?: Organization | null;
}

export function OrganizationView({
  className,
  classNames,
  isPending,
  size,
  organization,
}: OrganizationViewProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 truncate",
        className,
        classNames?.base,
      )}
    >
      <AiOutlineTeam
        className={cn("size-6", size !== "sm" && "my-0.5", classNames?.avatar)}
      />

      <div
        className={cn(
          "flex flex-col truncate text-left leading-tight",
          classNames?.content,
        )}
      >
        {isPending ? (
          <>
            <Skeleton
              className={cn(
                "max-w-full",
                size === "lg" ? "h-4.5 w-32" : "h-3.5 w-24",
                classNames?.title,
                classNames?.skeleton,
              )}
            />

            {size !== "sm" && (
              <Skeleton
                className={cn(
                  "mt-1.5 max-w-full",
                  size === "lg" ? "h-3.5 w-24" : "h-3 w-16",
                  classNames?.subtitle,
                  classNames?.skeleton,
                )}
              />
            )}
          </>
        ) : (
          <>
            <span
              className={cn(
                "truncate font-semibold",
                size === "lg" ? "text-base" : "text-sm",
                classNames?.title,
              )}
            >
              {organization?.name || "Team"}
            </span>

            {size !== "sm" && organization?.slug && (
              <span
                className={cn(
                  "truncate opacity-70",
                  size === "lg" ? "text-sm" : "text-xs",
                  classNames?.subtitle,
                )}
              >
                {organization.slug}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
