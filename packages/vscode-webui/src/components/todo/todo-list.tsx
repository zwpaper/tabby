import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Todo } from "@ragdoll/server";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

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
}

export function TodoList({ todos }: TodoListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [animationCompleted, setAnimationCompleted] = useState(false);
  const inProgressTodoId = todos.find((x) => x.status === "in-progress")?.id;

  // Effect to scroll to the in-progress todo item when it's present and the list is open
  useEffect(() => {
    if (inProgressTodoId && !isCollapsed && animationCompleted) {
      const timer = setTimeout(() => {
        const element = document.getElementById(
          `todo-item-${inProgressTodoId}`,
        );
        element?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400); // Delay to allow expand animation to complete + item animation
      return () => clearTimeout(timer);
    }
  }, [inProgressTodoId, isCollapsed, animationCompleted]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={cn("mb-4")}>
      <button
        type="button"
        onClick={toggleCollapse}
        className="flex w-full items-center justify-between rounded-sm px-2 py-2 transition-colors hover:bg-accent/5 focus:outline-none"
        aria-expanded={!isCollapsed}
      >
        <div className="flex justify-center justify-center gap-2">
          <h3 className="font-semibold text-sm">TODOs</h3>
        </div>
      </button>
      <motion.div
        initial={false}
        animate={isCollapsed ? "collapsed" : "open"}
        variants={collapsibleSectionVariants}
        className="overflow-hidden"
      >
        <ScrollArea className="h-48 px-1 pt-1 pb-2">
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {todos.map((todo, idx) => (
                <motion.div
                  id={`todo-item-${todo.id}`}
                  key={todo.id}
                  className={cn(
                    "flex items-center space-x-2.5 rounded-sm p-1 transition-colors",
                    {
                      "bg-accent/5": todo.status === "in-progress",
                      "hover:bg-accent/5": todo.status !== "in-progress",
                    },
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
                  onAnimationComplete={() => {
                    if (idx === todos.length - 1) {
                      setAnimationCompleted(true);
                    }
                  }}
                >
                  {todo.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  ) : todo.status === "in-progress" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/70" />
                  )}
                  <Label
                    htmlFor={`todo-${todo.id}`}
                    className={cn("flex-1 text-md", {
                      "text-muted-foreground line-through":
                        todo.status === "completed",
                      "animated-gradient-text font-semibold":
                        todo.status === "in-progress",
                      "text-muted-foreground/90": todo.status === "pending",
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
