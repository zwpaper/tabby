import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { Todo } from "@ragdoll/server";
import { Circle, CircleCheckBig } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

const collapsibleSectionVariants = {
  open: {
    height: "auto",
    transition: { duration: 0.1, ease: "easeOut" },
  },
  collapsed: {
    height: 0,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

const todoItemVariants = {
  initial: { opacity: 0, y: 10, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -5, scale: 0.97 },
};

export interface TodoListProps {
  todos: Todo[];
  status: UseChatHelpers["status"];
}

export function TodoList({ todos, status }: TodoListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const inProgressTodo = useMemo(
    () => todos.find((x) => x.status === "in-progress"),
    [todos],
  );

  const pendingTodosNum = useMemo(
    () => todos.filter((todo) => todo.status === "pending").length,
    [todos],
  );

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={cn("mb-2")}>
      <div className="-mx-4 h-0 border-t" />
      <button
        type="button"
        onClick={toggleCollapse}
        className="flex w-full items-center justify-between overflow-hidden rounded-sm py-2 transition-colors focus:outline-none"
        aria-expanded={!isCollapsed}
      >
        <div className="flex w-full flex-nowrap items-center justify-center gap-2 overflow-hidden">
          <span className="h-6 truncate font-semibold">
            {inProgressTodo ? (
              <span
                className={cn({
                  "animated-gradient-text":
                    status === "submitted" || status === "streaming",
                })}
              >
                {inProgressTodo.content}
              </span>
            ) : (
              <span>{pendingTodosNum > 0 ? "TODOs" : "🎉 All done!"}</span>
            )}
          </span>
        </div>
      </button>
      <motion.div
        initial={false}
        animate={isCollapsed ? "collapsed" : "open"}
        variants={collapsibleSectionVariants}
        className="overflow-hidden"
      >
        <ScrollArea className="px-1 pt-1 pb-2" viewportClassname="max-h-48">
          <div className="flex flex-col gap-1">
            <AnimatePresence mode="popLayout">
              {todos.map((todo, idx) => (
                <motion.div
                  id={`todo-item-${todo.id}`}
                  key={todo.id}
                  className={cn(
                    "flex items-start space-x-2.5 rounded-sm p-1 transition-colors hover:bg-accent/5",
                  )}
                  variants={todoItemVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    delay: idx * 0.08 + 0.1,
                  }}
                >
                  <span className="flex h-6 shrink-0 items-center">
                    {todo.status === "completed" ? (
                      <CircleCheckBig className="size-4 text-muted-foreground" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground/70" />
                    )}
                  </span>
                  <Label
                    htmlFor={`todo-item-${todo.id}`}
                    className={cn("flex-1 text-md", {
                      "text-muted-foreground line-through":
                        todo.status === "completed",
                    })}
                  >
                    {todo.content}
                  </Label>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </motion.div>
    </div>
  );
}
