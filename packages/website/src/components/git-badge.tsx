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
    <div className={cn("flex flex-col md:flex-row", className)}>
      <span className="flex items-center">
        <IconComponent className="h-4 w-4" />
        <span>{displayText}</span>
      </span>
      {!!git.branch && (
        <span className="text-muted-foreground/60">@{git.branch}</span>
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
        className={cn("cursor-pointer transition-opacity", {
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
