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
import { cn } from "@/lib/utils";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { Todo } from "@getpochi/tools";
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
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

// Context for sharing state between compound components
interface TodoListContextValue {
  todos: Todo[];
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  // Edit mode state
  editState?: {
    status: UseChatHelpers["status"];
    isEditMode: boolean;
    draftTodos: Todo[];
    hasDirtyChanges: boolean;
    enterEditMode: () => void;
    exitEditMode: () => void;
    saveTodos: () => void;
    updateTodoStatus: (todoId: string, newStatus: Todo["status"]) => void;
  };
  setEditState?: (editState: TodoListContextValue["editState"]) => void;
}

const TodoListContext = createContext<TodoListContextValue | undefined>(
  undefined,
);

function useTodoListContext() {
  const context = useContext(TodoListContext);
  if (!context) {
    throw new Error(
      "TodoList compound components must be used within TodoList",
    );
  }
  return context;
}

// Main TodoList component
interface TodoListRootProps {
  todos: Todo[];
  className?: string;
  children: ReactNode;
}

function TodoListRoot({ todos, className, children }: TodoListRootProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editState, setEditState] =
    useState<TodoListContextValue["editState"]>();

  const contextValue: TodoListContextValue = {
    todos,
    isCollapsed,
    setIsCollapsed,
    editState,
    setEditState,
  };

  return (
    <TodoListContext.Provider value={contextValue}>
      <div className={className}>
        <div className="todo-border -mx-4 h-0 border-t" />
        {children}
      </div>
    </TodoListContext.Provider>
  );
}

// Header component with toggle functionality
interface TodoListHeaderProps {
  children?: ReactNode;
  disableCollapse?: boolean;
  disableInProgressTodoTitle?: boolean;
}

function TodoListHeader({
  disableCollapse,
  disableInProgressTodoTitle,
  children,
}: TodoListHeaderProps) {
  const { todos, isCollapsed, setIsCollapsed, editState } =
    useTodoListContext();
  const isEditMode = editState?.isEditMode || false;

  // Use draftTodos when in edit mode, otherwise use todos
  const displayTodos = editState?.isEditMode
    ? editState.draftTodos || []
    : todos.filter((todo) => todo.status !== "cancelled");

  const inProgressTodo = useMemo(
    () => displayTodos.find((x) => x.status === "in-progress"),
    [displayTodos],
  );

  const pendingTodosNum = useMemo(
    () => displayTodos.filter((todo) => todo.status === "pending").length,
    [displayTodos],
  );

  useEffect(() => {
    if (
      pendingTodosNum === 0 &&
      todos.length > 0 &&
      !disableCollapse &&
      !isEditMode
    ) {
      setIsCollapsed(true);
    }
  }, [pendingTodosNum, todos, setIsCollapsed, disableCollapse, isEditMode]);

  const toggleCollapse = () => {
    if (disableCollapse) return;
    if (editState?.isEditMode) return;
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className="group grid w-full cursor-pointer grid-cols-[1fr_auto_1fr] items-center"
      onClick={toggleCollapse}
    >
      <div />
      <button
        type="button"
        className={cn(
          "flex select-none items-center justify-center overflow-hidden rounded-sm px-4 py-2 transition-colors focus:outline-none",
          {
            "pointer-events-none": disableCollapse,
          },
        )}
      >
        <span className="h-6 truncate font-semibold transition-opacity group-focus-within:opacity-80 group-hover:opacity-80">
          {inProgressTodo ? (
            disableInProgressTodoTitle ? (
              <span>TODOs</span>
            ) : (
              <span
                className={cn({
                  "animated-gradient-text":
                    editState?.status === "submitted" ||
                    editState?.status === "streaming",
                })}
              >
                {inProgressTodo.content}
              </span>
            )
          ) : (
            <span>{pendingTodosNum > 0 ? "TODOs" : "🎉 All done!"}</span>
          )}
        </span>
      </button>
      <div className="flex justify-end">
        <div className="flex gap-1 p-2" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Edit actions component
interface TodoListEditActionsProps {
  status: UseChatHelpers["status"];
  showEdit: boolean;
  isEditMode: boolean;
  draftTodos: Todo[];
  hasDirtyChanges: boolean;
  enterEditMode: () => void;
  exitEditMode: () => void;
  saveTodos: () => void;
  updateTodoStatus: (todoId: string, newStatus: Todo["status"]) => void;
}

function TodoListEditActions({
  status,
  showEdit,
  isEditMode,
  draftTodos,
  hasDirtyChanges,
  enterEditMode,
  exitEditMode,
  saveTodos,
  updateTodoStatus,
}: TodoListEditActionsProps) {
  const context = useTodoListContext();
  const { isCollapsed, setEditState } = context;

  useEffect(() => {
    if (!setEditState) return;
    setEditState({
      status,
      isEditMode,
      draftTodos,
      hasDirtyChanges,
      enterEditMode,
      exitEditMode,
      saveTodos,
      updateTodoStatus,
    });
  }, [
    setEditState,
    status,
    isEditMode,
    draftTodos,
    hasDirtyChanges,
    enterEditMode,
    exitEditMode,
    saveTodos,
    updateTodoStatus,
  ]);

  const showEditTodos = showEdit;

  const handleSave = () => {
    saveTodos();
  };

  const handleCancel = () => {
    exitEditMode();
  };

  if (isCollapsed || !showEditTodos) {
    return null;
  }

  return (
    <>
      {isEditMode ? (
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
      )}
    </>
  );
}

// Todo icon component
interface TodoIconProps {
  todo: Todo;
}

function TodoIcon({ todo }: TodoIconProps) {
  const { editState } = useTodoListContext();

  if (!editState?.isEditMode || !editState.updateTodoStatus) {
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
                editState.updateTodoStatus(
                  todo.id,
                  option.value as Todo["status"],
                )
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

// Items component for displaying the todo list
function TodoListItems({
  className,
  viewportClassname,
}: { className?: string; viewportClassname?: string }) {
  const { todos, isCollapsed, editState } = useTodoListContext();

  // Use draftTodos when in edit mode, otherwise use todos
  const displayTodos = editState?.isEditMode
    ? editState.draftTodos || []
    : todos.filter((todo) => todo.status !== "cancelled");

  return (
    <ScrollArea
      className={cn("px-1 pb-2", className)}
      viewportClassname={viewportClassname}
    >
      <motion.div
        initial={false}
        animate={isCollapsed ? "collapsed" : "open"}
        variants={collapsibleSectionVariants}
        className="overflow-hidden"
      >
        <div className="flex flex-col gap-1">
          <AnimatePresence mode="popLayout">
            {displayTodos.map((todo, idx) => (
              <motion.div
                id={`todo-item-${todo.id}`}
                key={todo.id}
                className={cn(
                  "flex items-start space-x-2.5 rounded-sm p-1 transition-colors",
                  !editState?.isEditMode && "hover:bg-accent/5",
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
                <TodoIcon todo={todo} />
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
      </motion.div>
    </ScrollArea>
  );
}

// Compound component exports
export const TodoList = Object.assign(TodoListRoot, {
  Header: TodoListHeader,
  EditActions: TodoListEditActions,
  Items: TodoListItems,
});

// Legacy interface for backward compatibility
export interface LegacyTodoListProps {
  todos: Todo[];
  status: UseChatHelpers["status"];
  isEditMode: boolean;
  draftTodos: Todo[];
  hasDirtyChanges: boolean;
  enterEditMode: () => void;
  exitEditMode: () => void;
  saveTodos: () => void;
  updateTodoStatus: (todoId: string, newStatus: Todo["status"]) => void;
  showEdit: boolean;
  className?: string;
}

// Legacy TodoList component for backward compatibility
export function LegacyTodoList({
  todos,
  status,
  isEditMode,
  draftTodos,
  hasDirtyChanges,
  enterEditMode,
  exitEditMode,
  saveTodos,
  updateTodoStatus,
  showEdit,
  className,
}: LegacyTodoListProps) {
  return (
    <TodoList todos={todos} className={className}>
      <TodoList.Header>
        <TodoList.EditActions
          status={status}
          showEdit={showEdit}
          isEditMode={isEditMode}
          draftTodos={draftTodos}
          hasDirtyChanges={hasDirtyChanges}
          enterEditMode={enterEditMode}
          exitEditMode={exitEditMode}
          saveTodos={saveTodos}
          updateTodoStatus={updateTodoStatus}
        />
      </TodoList.Header>
      <TodoList.Items viewportClassname="max-h-48" />
    </TodoList>
  );
}
