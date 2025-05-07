import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"; // Import pagination components
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiClient } from "@/lib/auth-client";
import { CustomHtmlTags } from "@/lib/constants";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import {
  CheckCircle2,
  Edit3,
  HelpCircle,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import type { Parent, Root, Text } from "mdast";
import { remark } from "remark";
import remarkStringify from "remark-stringify";

export const Route = createFileRoute("/tasks")({
  validateSearch: (search: Record<string, unknown>): { page?: number } => {
    return {
      page: Number(search.page ?? 1),
    };
  },
  component: App,
});

const getPaginationItems = (
  currentPage: number,
  totalPages: number,
  onPageChange: (page: number) => void,
) => {
  const items = [];
  const pageLimit = 5; // Max number of page links to show
  const sidePages = 1; // Number of pages to show on each side of current page

  // Previous button
  items.push(
    <PaginationItem key="prev">
      <PaginationPrevious
        onClick={() => onPageChange(currentPage - 1)}
        // @ts-expect-error todo: fix type
        disabled={currentPage <= 1}
      />
    </PaginationItem>,
  );

  if (totalPages <= pageLimit) {
    // Show all pages if total pages is less than or equal to limit
    for (let i = 1; i <= totalPages; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => onPageChange(i)}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>,
      );
    }
  } else {
    // Show first page
    items.push(
      <PaginationItem key={1}>
        <PaginationLink
          onClick={() => onPageChange(1)}
          isActive={currentPage === 1}
        >
          1
        </PaginationLink>
      </PaginationItem>,
    );

    // Ellipsis after first page if needed
    if (currentPage > sidePages + 2) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>,
      );
    }

    // Pages around current page
    const startPage = Math.max(2, currentPage - sidePages);
    const endPage = Math.min(totalPages - 1, currentPage + sidePages);

    for (let i = startPage; i <= endPage; i++) {
      if (i === 1 || i === totalPages) continue; // Skip if it's the first or last page (already handled)
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => onPageChange(i)}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>,
      );
    }

    // Ellipsis before last page if needed
    if (currentPage < totalPages - sidePages - 1) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>,
      );
    }

    // Show last page
    items.push(
      <PaginationItem key={totalPages}>
        <PaginationLink
          onClick={() => onPageChange(totalPages)}
          isActive={currentPage === totalPages}
        >
          {totalPages}
        </PaginationLink>
      </PaginationItem>,
    );
  }

  // Next button
  items.push(
    <PaginationItem key="next">
      <PaginationNext
        onClick={() => onPageChange(currentPage + 1)}
        // @ts-expect-error todo: fix type
        disabled={currentPage >= totalPages}
      />
    </PaginationItem>,
  );

  return items;
};

function App() {
  const router = useRouter();
  const { page = 1 } = Route.useSearch();
  const limit = 20;

  const { data, isPlaceholderData } = useQuery({
    queryKey: ["tasks", page, limit],
    queryFn: () =>
      apiClient.api.tasks
        .$get({ query: { page: page.toString(), limit: limit.toString() } })
        .then((x) => x.json()),
    placeholderData: keepPreviousData,
  });

  const tasks = data?.data || [];
  const meta = data?.pagination; // Adjusted to use 'pagination' from API response

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (meta?.totalPages && newPage > meta.totalPages)) return;
    router.navigate({
      to: "/tasks",
      search: (prev) => ({ ...prev, page: newPage }),
    });
  };

  return (
    <div className="flex h-screen w-full flex-col pt-4">
      <ScrollArea className="h-full max-h-screen overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 px-4">
          {isPlaceholderData
            ? [...Array(limit)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xs bg-card p-5">
                  <div className="mb-2 h-4 w-1/4 rounded bg-card/70" />
                  <div className="h-4 w-3/4 rounded bg-card/70" />
                </div>
              ))
            : tasks.map((task) => (
                <Link
                  to={"/"}
                  search={{ taskId: task.id }}
                  className="cursor-pointer"
                  key={task.id}
                >
                  <div className="rounded-xs bg-card p-5 hover:bg-card/70">
                    <div className="mb-1 flex items-center gap-4">
                      <span className="font-bold">{formatTaskId(task.id)}</span>
                      <div className="flex items-center">
                        <TaskStatusIcon status={task.status} />
                      </div>
                    </div>

                    <div className="text-foreground">
                      <p>{processTitle(task.title, CustomHtmlTags)}</p>
                    </div>
                  </div>
                </Link>
              ))}
        </div>
      </ScrollArea>
      {meta?.totalPages && meta.totalPages > 1 && (
        <Pagination className="mt-6 mb-4">
          <PaginationContent>
            {getPaginationItems(page, meta.totalPages, handlePageChange)}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function formatTaskId(id: number) {
  return `TASK-${Number(id).toString().padStart(3, "0")}`;
}

function processTitle(title: string, tagNames: string[]) {
  const ast = remark().parse(title);
  removePairedHtmlTags(ast, tagNames);

  return remark()
    .use(remarkStringify, {
      emphasis: "*",
      handlers: {
        text: (node: Text) => node.value,
      },
    })
    .stringify(ast)
    .trim();
}

function removePairedHtmlTags(ast: Root, tagnames: string[] = []) {
  function processNode(node: Parent) {
    if (node.children) {
      const stack: { tag: string; index: number }[] = [];
      const toRemove = new Set();

      node.children.forEach((child, index) => {
        if (child.type === "html") {
          const match = child.value.match(/^<\/?([a-zA-Z]+)[^>]*>$/);
          if (match) {
            const isClosing = match[0].startsWith("</");
            const tagName = match[1];

            if (tagnames.includes(tagName)) {
              if (isClosing) {
                // match closing tag
                if (
                  stack.length > 0 &&
                  stack[stack.length - 1].tag === tagName
                ) {
                  const start = stack.pop();
                  if (start) {
                    toRemove.add(start.index);
                    toRemove.add(index);
                  }
                }
              } else {
                stack.push({ tag: tagName, index });
              }
            }
          }
        }
      });

      node.children = node.children.filter((_, i) => !toRemove.has(i));

      for (const child of node.children) {
        processNode(child as Parent);
      }
    }
  }

  processNode(ast);
}

const TaskStatusIcon = ({ status }: { status: string }) => {
  const iconProps = { className: "inline-block mr-1 h-4 w-4 align-middle" };
  switch (status) {
    case "streaming":
      return <Zap {...iconProps} aria-label="Streaming" />;
    case "pending-tool":
      return <Wrench {...iconProps} aria-label="Pending Tool" />;
    case "pending-input":
      return <Edit3 {...iconProps} aria-label="Pending Input" />;
    case "completed":
      return (
        <CheckCircle2
          {...iconProps}
          className={`${iconProps.className} text-green-500`}
          aria-label="Completed"
        />
      );
    case "failed":
      return (
        <XCircle
          {...iconProps}
          className={`${iconProps.className} text-red-500`}
          aria-label="Failed"
        />
      );
    default:
      return (
        <HelpCircle {...iconProps} aria-label={`Unknown Status: ${status}`} />
      );
  }
};
