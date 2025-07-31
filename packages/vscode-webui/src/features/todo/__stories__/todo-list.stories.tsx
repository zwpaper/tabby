import { LegacyTodoList } from "@/features/todo";
import type { Todo } from "@getpochi/tools";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

const meta: Meta<typeof LegacyTodoList> = {
  title: "Chat/TODO",
  component: Page,
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function Page(props: any) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftTodos, setDraftTodos] = useState<Todo[]>(props.todos || []);

  const enterEditMode = () => {
    setDraftTodos([...props.todos]);
    setIsEditMode(true);
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setDraftTodos([]);
  };

  const saveTodos = () => {
    console.log("Saving todos:", draftTodos);
    setIsEditMode(false);
    setDraftTodos([]);
  };

  const updateTodoStatus = (todoId: string, newStatus: Todo["status"]) => {
    setDraftTodos(
      draftTodos.map((todo) => {
        if (todo.id === todoId) {
          return { ...todo, status: newStatus };
        }
        return todo;
      }),
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div style={{ flex: 1 }} />
      <LegacyTodoList
        {...props}
        isEditMode={isEditMode}
        draftTodos={draftTodos}
        enterEditMode={enterEditMode}
        exitEditMode={exitEditMode}
        saveTodos={saveTodos}
        updateTodoStatus={updateTodoStatus}
        hasDirtyChanges={true}
      />
    </div>
  );
}

export default meta;
type Story = StoryObj<typeof meta>;

const todoList1: Todo[] = [
  {
    id: "search-earth-view-image",
    status: "pending",
    content: "Search Earth View Image via Location",
    priority: "high",
  },
  {
    id: "browse-image-via-map",
    status: "in-progress",
    content:
      "Browse Image via Map, this is a looooooooooooooooooooooooooooooooooooong task",
    priority: "high",
  },
  {
    id: "download-image",
    status: "pending",
    content: "Download Image",
    priority: "high",
  },
  {
    id: "display-earth-view-image",
    status: "completed",
    content: "Display Earth View Image",
    priority: "high",
  },
];

const todoList2: Todo[] = [
  {
    id: "display-earth-view-image",
    status: "completed",
    content: "Display Earth View Image",
    priority: "high",
  },
  {
    id: "browse-image-via-map",
    status: "completed",
    content:
      "Browse Image via Map, this is a looooooooooooooooooooooooooooooooooooong task",
    priority: "high",
  },
  {
    id: "download-image",
    status: "pending",
    content: "Download Image",
    priority: "high",
  },
];

export const TodoList1: Story = {
  args: {
    todos: todoList1,
    status: "submitted",
  },
  parameters: {
    backgrounds: { disable: true },
    layout: "fullscreen",
    viewport: {
      defaultViewport: "vscodeMedium",
    },
  },
};

export const TodoList2: Story = {
  args: {
    todos: todoList2,
    status: "submitted",
  },
  parameters: {
    backgrounds: { disable: true },
    layout: "fullscreen",
    viewport: {
      defaultViewport: "vscodeMedium",
    },
  },
};
