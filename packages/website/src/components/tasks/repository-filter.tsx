"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  IconBrandBitbucket,
  IconBrandGithub,
  IconBrandGitlab,
} from "@tabler/icons-react";
import { Check, ChevronsUpDown, FolderGitIcon } from "lucide-react";
import { useState } from "react";
import type { Repository } from "./task-filters";

const iconMap = {
  github: IconBrandGithub,
  gitlab: IconBrandGitlab,
  bitbucket: IconBrandBitbucket,
  git: FolderGitIcon,
};

interface RepositoryFilterProps {
  repositories: Repository[];
  selectedRepository?: string;
  onRepositoryChange: (repository?: string) => void;
}

export function RepositoryFilter({
  repositories,
  selectedRepository,
  onRepositoryChange,
}: RepositoryFilterProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (repoId?: string) => {
    onRepositoryChange(repoId);
    setOpen(false);
  };

  const selectedRepo = repositories.find((r) => r.id === selectedRepository);
  const Icon = selectedRepo?.platform
    ? iconMap[selectedRepo.platform as keyof typeof iconMap]
    : FolderGitIcon;

  const getDisplayName = () => {
    if (selectedRepo) {
      return selectedRepo.name;
    }
    if (selectedRepository) {
      const [_platform, ...nameParts] = selectedRepository.split(":");
      return nameParts.join(":");
    }
    return "All Repositories";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-expanded={open}
          className="w-full justify-between sm:w-[240px]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="truncate">{getDisplayName()}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command>
          <CommandInput placeholder="Search repositories..." />
          <CommandList>
            <CommandEmpty>No repositories found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => handleSelect(undefined)}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !selectedRepository ? "opacity-100" : "opacity-0",
                  )}
                />
                All Repositories
              </CommandItem>
              {repositories.map((repo) => {
                const Icon = repo.platform
                  ? iconMap[repo.platform as keyof typeof iconMap]
                  : FolderGitIcon;
                return (
                  <CommandItem
                    key={repo.id}
                    value={repo.name}
                    onSelect={() => handleSelect(repo.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedRepository === repo.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{repo.name}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
