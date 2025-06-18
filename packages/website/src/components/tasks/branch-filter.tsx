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
import { Check, ChevronsUpDown, GitBranch } from "lucide-react";
import { useState } from "react";
import type { Branch } from "./task-filters";

interface BranchFilterProps {
  branches: Branch[];
  selectedBranch?: string;
  onBranchChange: (branch?: string) => void;
}

export function BranchFilter({
  branches,
  selectedBranch,
  onBranchChange,
}: BranchFilterProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (branchName?: string) => {
    onBranchChange(branchName);
    setOpen(false);
  };

  const getDisplayName = () => {
    if (selectedBranch) {
      return (
        branches.find((b) => b.name === selectedBranch)?.name ?? selectedBranch
      );
    }
    return "All branches";
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
            <GitBranch className="h-4 w-4" />
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
          <CommandInput placeholder="Search branches..." />
          <CommandList>
            <CommandEmpty>No branches found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => handleSelect(undefined)}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !selectedBranch ? "opacity-100" : "opacity-0",
                  )}
                />
                All branches
              </CommandItem>
              {branches.map((branch) => (
                <CommandItem
                  key={branch.name}
                  value={branch.name}
                  onSelect={() => handleSelect(branch.name)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedBranch === branch.name
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {branch.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
