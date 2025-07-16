import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiClient } from "@/lib/auth-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DeleteTaskButtonProps {
  uid: string;
  disabled?: boolean;
}

export function DeleteTaskButton({ uid, disabled }: DeleteTaskButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.api.tasks[":uid"].$delete({
        param: { uid },
      });

      if (!response.ok) {
        throw new Error("Failed to delete task");
      }

      return response.json();
    },
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: () => {
      toast.success("Task deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      // Navigate back to tasks list
      router.navigate({
        to: "/tasks",
        search: {
          page: 1,
          pageSize: 20,
        },
      });
    },
    onError: (error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    },
    onSettled: () => {
      setIsDeleting(false);
      setIsPopoverOpen(false);
    },
  });

  const handleConfirmDelete = () => {
    if (isDeleting) return;
    deleteMutation.mutate();
  };

  const handleCancelDelete = () => {
    setIsPopoverOpen(false);
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || isDeleting}
          className="gap-1 rounded-md text-xs transition-opacity"
        >
          <Trash2 className="size-4" />
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 flex-shrink-0 text-amber-500" />
            <div>
              <h4 className="font-medium text-sm">Delete Task</h4>
              <p className="mt-1 text-muted-foreground text-sm">
                Are you sure you want to delete this task? This action cannot be
                undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
