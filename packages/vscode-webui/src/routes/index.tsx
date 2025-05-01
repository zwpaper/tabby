import { buttonVariants } from "@/components/ui/button";
import { apiClient } from "@/lib/auth-client";
import { CustomHtmlTags } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import type { Parent, Root, Text } from "mdast";
import { remark } from "remark";
import remarkStringify from "remark-stringify";

export const Route = createFileRoute("/")({
  component: App,
  loader: () => {
    throw redirect({ to: "/chat" });
  },
});

function App() {
  const { auth } = Route.useRouteContext();
  const page = 1;
  const limit = 20;
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", page, limit],
    queryFn: () =>
      apiClient.api.tasks
        .$get({ query: { page: page.toString(), limit: limit.toString() } })
        .then((x) => x.json()),
  });

  const tasks = data?.data || [];

  return (
    <div className="p-2">
      <div className="mb-2">Welcome, {auth.user.name}!</div>
      <Link
        to="/chat"
        className={cn(
          buttonVariants({
            variant: "default",
            className: "w-full mt-2 mb-4 !text-primary-foreground !text-base",
          }),
        )}
      >
        <PlusIcon />
        New Task
      </Link>

      <div className="mt-2">
        <div className="flex flex-col space-y-4">
          {isLoading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-card p-2 rounded-xs animate-pulse">
                  <div className="h-4 bg-card/70 rounded w-1/4 mb-2" />
                  <div className="h-4 bg-card/70 rounded w-3/4" />
                </div>
              ))}
            </>
          ) : (
            tasks.map((task) => (
              <Link
                to={"/chat"}
                search={{ taskId: task.id }}
                className="cursor-pointer"
                key={task.id}
              >
                <div className="bg-card p-2 rounded-xs hover:bg-card/70">
                  <span className="font-bold mb-1">
                    {formatTaskId(task.id)}
                  </span>
                  <div className="text-foreground">
                    <p>{processTitle(task.title, CustomHtmlTags)}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
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
