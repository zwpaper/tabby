"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { apiClient } from "@/lib/auth-client";
import type { InferResponseType } from "hono/client";

type Task = InferResponseType<
  (typeof apiClient.api.tasks)["$get"]
>["data"][number];

interface TaskRowActionsProps {
  task: Task;
}

export function TaskRowActions({ task }: TaskRowActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const onDelete = async () => {
    setIsDeleting(true);
    toast.promise(
      apiClient.api.tasks[":uid"].$delete({
        param: { uid: task.uid },
      }),
      {
        loading: "Deleting task...",
        success: () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          setIsDeleting(false);
          return "Task deleted successfully.";
        },
        error: (err) => {
          setIsDeleting(false);
          return `Failed to delete task: ${err.message}`;
        },
      },
    );
  };

  function openVSCode() {
    window.open(`vscode://TabbyML.pochi/?task=${task.uid}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <MoreHorizontal />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem onClick={openVSCode}>
          Open
          <DropdownMenuShortcut>⌘L</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} disabled={isDeleting}>
          Delete
          <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
