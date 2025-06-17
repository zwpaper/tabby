import { DataTablePagination } from "@/components/data-table-pagination";
import { MinionRow } from "@/components/minions/minion-row";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/auth-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";

const minionSearchSchema = z.object({
  page: z.number().min(1).optional().default(1),
  pageSize: z.number().min(10).max(50).optional().default(20),
});

export const Route = createFileRoute("/_authenticated/_base/minions/")({
  component: MinionsPage,
  validateSearch: (search) => minionSearchSchema.parse(search),
});

const limit = 100;
function MinionsPage() {
  const router = useRouter();
  const { page, pageSize } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["minions", 1, limit],
    queryFn: () =>
      apiClient.api.minions
        .$get({
          query: { page: "1", limit: limit.toString() },
        })
        .then((x) => x.json()),
    placeholderData: keepPreviousData,
  });

  const allMinions = data?.data || [];
  const totalPages = Math.ceil(allMinions.length / pageSize);
  const minions = allMinions.slice((page - 1) * pageSize, page * pageSize);

  const onPageChange = (page: number) => {
    router.navigate({
      to: "/minions",
      search: {
        pageSize,
        page,
      },
    });
  };

  const onPageSizeChange = (newPageSize: number) => {
    router.navigate({
      to: "/minions",
      search: {
        pageSize: newPageSize,
        page: 1, // Reset to page 1 when pageSize changes
      },
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto h-full max-w-6xl flex-1 flex-col space-y-8 px-2 pt-0 pb-8 md:flex md:px-6">
        <Loading />
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-6xl flex-1 flex-col space-y-8 px-2 pt-0 pb-8 md:flex md:px-6">
      <div className="space-y-4">
        <div className="space-y-2">
          {minions.map((minion) => (
            <MinionRow key={minion.id} minion={minion} />
          ))}
        </div>
        <DataTablePagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[78px] w-full" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[100px]" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}
