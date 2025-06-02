import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAllowEditTodos } from "@/features/settings";
import { cn } from "@/lib/utils";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { Todo } from "@ragdoll/common";
import {
  Circle,
  CircleCheckBig,
  CircleDot,
  CircleX,
  Edit3,
  Save,
  X,
} from "lucide-react";
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

interface TodoIconProps {
  todo: Todo;
  isEditMode: boolean;
  onStatusChange: (todoId: string, newStatus: Todo["status"]) => void;
}

function TodoIcon({ todo, isEditMode, onStatusChange }: TodoIconProps) {
  if (!isEditMode) {
    // Normal mode - just show status icon
    return (
      <div className="flex h-6 shrink-0 items-center">
        {todo.status === "completed" ? (
          <CircleCheckBig className="size-4 text-muted-foreground" />
        ) : todo.status === "in-progress" ? (
          <CircleDot className="size-4 text-muted-foreground" />
        ) : todo.status === "cancelled" ? (
          <CircleX className="size-4 text-muted-foreground" />
        ) : (
          <Circle className="size-4 text-muted-foreground/70" />
        )}
      </div>
    );
  }

  const getStatusIcon = (status: Todo["status"]) => {
    switch (status) {
      case "pending":
        return <Circle className="size-4" />;
      case "in-progress":
        return <CircleDot className="size-4" />;
      case "completed":
        return <CircleCheckBig className="size-4" />;
      case "cancelled":
        return <CircleX className="size-4" />;
      default:
        return <Circle className="size-4" />;
    }
  };

  const statusOptions = [
    { value: "pending", icon: Circle, label: "Pending" },
    { value: "completed", icon: CircleCheckBig, label: "Completed" },
    { value: "cancelled", icon: CircleX, label: "Cancelled" },
  ].filter((option) => option.value !== todo.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="!px-0 !py-0">
          {getStatusIcon(todo.status)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-32">
        {statusOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() =>
                onStatusChange(todo.id, option.value as Todo["status"])
              }
              className="flex items-center gap-2"
            >
              <IconComponent className="size-4" />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface TodoListProps {
  todos: Todo[];
  status: UseChatHelpers["status"];
  isEditMode: boolean;
  draftTodos: Todo[];
  hasDirtyChanges: boolean;
  enterEditMode: () => void;
  exitEditMode: () => void;
  saveTodos: () => void;
  updateTodoStatus: (todoId: string, newStatus: Todo["status"]) => void;
  allowEdit: boolean;
  className?: string;
}

export function TodoList({
  todos,
  status,
  isEditMode,
  draftTodos,
  hasDirtyChanges,
  enterEditMode,
  exitEditMode,
  saveTodos,
  updateTodoStatus,
  allowEdit,
  className,
}: TodoListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const allowEditTodos = useAllowEditTodos() && allowEdit;

  // Use draftTodos when in edit mode, otherwise use todos
  const displayTodos = isEditMode
    ? draftTodos
    : todos.filter((todo) => todo.status !== "cancelled");

  const inProgressTodo = useMemo(
    () => displayTodos.find((x) => x.status === "in-progress"),
    [displayTodos],
  );

  const pendingTodosNum = useMemo(
    () => displayTodos.filter((todo) => todo.status === "pending").length,
    [displayTodos],
  );

  const toggleCollapse = () => {
    if (isEditMode) return;
    setIsCollapsed(!isCollapsed);
  };

  const handleSave = () => {
    saveTodos();
  };

  const handleCancel = () => {
    exitEditMode();
  };

  return (
    <div className={className}>
      <div className="-mx-4 h-0 border-t" />
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
        <div />
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex items-center justify-center overflow-hidden rounded-sm px-4 py-2 transition-colors focus:outline-none"
        >
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
        </button>
        <div className="flex justify-end gap-1 pr-2">
          {!isCollapsed &&
            allowEditTodos &&
            (isEditMode ? (
              <>
                {hasDirtyChanges && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="xs" onClick={handleSave}>
                        <Save className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Save changes</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleCancel}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancel editing</p>
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={enterEditMode}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Edit3 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit todos</p>
                </TooltipContent>
              </Tooltip>
            ))}
        </div>
      </div>
      <motion.div
        initial={false}
        animate={isCollapsed ? "collapsed" : "open"}
        variants={collapsibleSectionVariants}
        className="overflow-hidden"
      >
        <ScrollArea className="px-1 pt-1 pb-2" viewportClassname="max-h-48">
          <div className="flex flex-col gap-1">
            <AnimatePresence mode="popLayout">
              {displayTodos.map((todo, idx) => (
                <motion.div
                  id={`todo-item-${todo.id}`}
                  key={todo.id}
                  className={cn(
                    "flex items-start space-x-2.5 rounded-sm p-1 transition-colors",
                    !isEditMode && "hover:bg-accent/5",
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
                  <TodoIcon
                    todo={todo}
                    isEditMode={isEditMode}
                    onStatusChange={updateTodoStatus}
                  />
                  <Label
                    htmlFor={`todo-item-${todo.id}`}
                    className={cn("flex-1 text-md", {
                      "text-muted-foreground line-through":
                        todo.status === "completed" ||
                        todo.status === "cancelled",
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
