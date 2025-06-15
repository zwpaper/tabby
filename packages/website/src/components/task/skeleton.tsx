import { Skeleton } from "@/components/ui/skeleton";
import { MessageContentSkeleton } from "./content";

function TaskPageSkeleton() {
  return (
    <div className="mx-auto mt-4 flex max-w-6xl flex-1 flex-col space-y-8">
      {/* Task header Skeleton */}
      <div className="animate-pulse space-y-4 px-4 pt-2">
        <div className="mt-2 flex items-start gap-3">
          <div className="flex flex-1 flex-col space-y-3 overflow-hidden pr-8">
            <span className="flex items-center gap-2">
              <Skeleton className="h-8 w-3/5 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </span>
            <div className="flex min-h-4 flex-col gap-3 text-sm md:flex-row">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-28 rounded-md" />
              </div>
              <div className="items-center gap-4">
                <Skeleton className="h-4 w-36 rounded-md" />
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
