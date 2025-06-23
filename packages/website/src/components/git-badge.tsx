import type { apiClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  getGitPlatformIcon,
  parseGitOriginUrl,
} from "@ragdoll/common/git-utils";
import {
  IconBrandBitbucket,
  IconBrandGithub,
  IconBrandGitlab,
} from "@tabler/icons-react";
import type { InferResponseType } from "hono/client";
import { FolderGitIcon } from "lucide-react";

type Task = NonNullable<
  InferResponseType<(typeof apiClient.api.tasks)["$get"]>
>["data"][number];

export function GitBadge({
  className,
  git,
  interactive = true,
}: {
  git: Task["git"];
  className?: string;
  interactive?: boolean;
}) {
  if (!git?.origin) return null;

  const repoInfo = parseGitOriginUrl(git.origin);

  const iconMap = {
    github: IconBrandGithub,
    gitlab: IconBrandGitlab,
    bitbucket: IconBrandBitbucket,
    git: FolderGitIcon,
  };

  const IconComponent = repoInfo
    ? iconMap[getGitPlatformIcon(repoInfo.platform)]
    : FolderGitIcon;

  // Display shorthand if available, otherwise fallback to origin/branch
  const displayText = repoInfo
    ? repoInfo.shorthand
    : `${git.origin}/${git.branch}`;

  const badgeContent = (
    <div
      className={cn("flex max-w-full items-center overflow-hidden", className)}
    >
      <IconComponent className="mr-1.5 h-3 w-3 shrink-0 opacity-70 sm:h-3.5 sm:w-3.5 md:mr-0.5" />
      <span>{displayText}</span>
      {!!git.branch && (
        <span className="truncate text-muted-foreground/60">@{git.branch}</span>
      )}
    </div>
  );

  // If it's a recognized platform with a web URL, make it clickable
  if (repoInfo?.webUrl) {
    return (
      <span
        onClick={(e) => {
          if (interactive) {
            e.stopPropagation();
            window.open(repoInfo.webUrl, "_blank", "noopener,noreferrer");
          }
        }}
        className={cn("cursor-pointer overflow-hidden transition-opacity", {
          "hover:opacity-80": interactive,
        })}
        title={
          interactive
            ? `Open ${repoInfo.shorthand} on ${repoInfo.platform}`
            : undefined
        }
      >
        {badgeContent}
      </span>
    );
  }

  return badgeContent;
}
