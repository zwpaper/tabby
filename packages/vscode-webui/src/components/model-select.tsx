"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import LoadingWrapper from "@/components/loading-wrapper";
import type { Models } from "@/lib/hooks/use-models";
import { DropdownMenuPortal } from "@radix-ui/react-dropdown-menu";

interface ModelSelectProps {
  models: Models;
  value: string | undefined;
  onChange: (v: string) => void;
  isLoading?: boolean;
  triggerClassName?: string;
}

export function ModelSelect({
  models,
  value,
  onChange,
  isLoading,
  triggerClassName,
}: ModelSelectProps) {
  const onSelectModel = (v: string) => {
    onChange(v);
  };

  return (
    <LoadingWrapper
      loading={isLoading}
      fallback={
        <div className="p-1">
          <Skeleton className="h-4 w-32 bg-[var(--vscode-inputOption-hoverBackground)]" />
        </div>
      }
    >
      {!!models?.length && (
        <div className="h-6 select-none overflow-hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "!gap-0.5 !px-1 h-6 max-w-full py-0 font-normal focus-visible:ring-1",
                  triggerClassName,
                )}
              >
                <span className="truncate whitespace-nowrap">{value}</span>
                <ChevronDownIcon className="size-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                onCloseAutoFocus={(e) => e.preventDefault()}
                side="bottom"
                align="end"
                className="dropdown-menu max-h-[30vh] min-w-[18rem] animate-in overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-2 text-popover-foreground shadow"
              >
                <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
                  {models.map((model) => {
                    const isSelected = model.id === value;
                    return (
                      <DropdownMenuRadioItem
                        onClick={(e) => {
                          onSelectModel(model.id);
                          e.stopPropagation();
                        }}
                        value={model.id}
                        key={model.id}
                        className="cursor-pointer py-2 pl-2"
                      >
                        <CheckIcon
                          className={cn(
                            "mr-1 shrink-0",
                            model.id === value ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span
                          className={cn({
                            "font-semibold": isSelected,
                          })}
                        >
                          {model.id}
                        </span>
                      </DropdownMenuRadioItem>
                    );
                  })}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        </div>
      )}
    </LoadingWrapper>
  );
}
