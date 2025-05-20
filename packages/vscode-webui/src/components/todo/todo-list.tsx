import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Todo } from "@ragdoll/server";
import { CheckCircle2, Circle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const collapsibleSectionVariants = {
  open: {
    height: "auto",
    transition: { duration: 0.2, ease: "easeInOut" },
  },
  collapsed: {
    height: 0,
    transition: { duration: 0.1, ease: "easeInOut" },
  },
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

  const getPriorityBadgeVariant = (
    priority: Todo["priority"],
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
    }
  };

  return (
    <div className="mb-4 rounded-md border">
      <button
        type="button"
        onClick={toggleCollapse}
        className="flex w-full items-center justify-between px-3 py-2 focus:outline-none"
      >
        <h3 className="font-semibold text-lg">TODOs ({todos.length})</h3>
      </button>
      <motion.div
        initial={false}
        animate={isCollapsed ? "collapsed" : "open"}
        variants={collapsibleSectionVariants}
        className="overflow-hidden"
      >
        <div className="max-h-36 space-y-2 overflow-y-auto p-4 pt-0">
          <AnimatePresence>
            {todos.map((todo, idx) => (
              <motion.div
                id={`todo-item-${todo.id}`} // Assign DOM ID
                key={todo.id}
                className="flex items-center space-x-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: idx * 0.1 + 0.2,
                }}
                onAnimationComplete={() => {
                  if (idx === todos.length - 1) {
                    console.log("callllllll");
                    setAnimationCompleted(true);
                  }
                }}
              >
                {todo.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
                <Label
                  htmlFor={`todo-${todo.id}`}
                  className={cn("flex-1 text-foreground", {
                    "text-foreground": todo.status === "completed",
                    "animated-gradient-text font-semibold":
                      todo.status === "in-progress",
                    "text-muted-foreground": todo.status === "pending",
                  })}
                >
                  {todo.content}
                </Label>
                <Badge variant={getPriorityBadgeVariant(todo.priority)}>
                  {todo.priority}
                </Badge>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
