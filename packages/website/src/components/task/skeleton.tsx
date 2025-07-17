import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MessageContentSkeleton } from "./content";

function TaskPageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-6xl flex-1 flex-col space-y-8",
        className,
      )}
    >
      {/* Task header Skeleton */}
      <div className="animate-pulse space-y-4 px-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col space-y-3 overflow-hidden pr-8">
            <span className="flex items-center gap-2 py-0.5">
              <Skeleton className="h-7 w-3/5 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </span>
            <div className="flex min-h-5 flex-col gap-3 text-sm md:flex-row">
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-5 w-28 rounded-md" />
              </div>
              <div className="items-center gap-4">
                <Skeleton className="h-5 w-36 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <MessageContentSkeleton />
    </div>
  );
}

export { TaskPageSkeleton };
