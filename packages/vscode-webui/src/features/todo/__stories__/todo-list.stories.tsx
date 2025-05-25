import { TodoList } from "@/features/todo";
import type { Todo } from "@ragdoll/common";
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof TodoList> = {
  title: "Pochi/TODO",
  component: TodoList,
};

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
    status: "pending",
    content: "Browse Image via Map",
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

export const TodoList1: Story = {
  args: {
    todos: todoList1,
    status: "submitted",
  },
  parameters: {
    backgrounds: { disable: true },
  },
};
