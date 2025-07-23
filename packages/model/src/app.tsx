import { useRef, useState } from "react";
import { FileControls } from "./components/file-controls";
import { ResponseToc } from "./components/response-toc";
import { TaskBar } from "./components/task-bar";
import { TaskList } from "./components/task-list";
import { TaskView, type TaskViewHandle } from "./components/task-view";
import { TaskViewProvider } from "./contexts/task-view-context";
import type { TaskData } from "./types";

function App() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [editingPart, setEditingPart] = useState<{
    taskUid: string;
    messageIndex: number;
    partIndex: number | null;
    isEditingNew?: boolean; // New: flag to indicate editing newContent
  } | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTocOpen, setIsTocOpen] = useState(true);
  const taskViewRef = useRef<TaskViewHandle>(null);

  const handleImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const lines = text.trim().split("\n");
        const parsedTasks = lines
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch (error) {
              console.error("Failed to parse line:", line, error);
              return null;
            }
          })
          .filter(Boolean) as TaskData[];
        const existingUids = new Set(tasks.map((task) => task.uid));
        const uniqueTasks = parsedTasks.filter(
          (task) => !existingUids.has(task.uid),
        );
        setTasks((prevTasks) => [...uniqueTasks, ...prevTasks]);
        setSelectedTask(null);
        setEditingPart(null);
      }
    } catch (error) {
      console.error("Failed to read from clipboard:", error);
      alert(
        "Failed to read from clipboard. Please make sure you have granted permission and there is text in the clipboard.",
      );
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.trim().split("\n");
      const parsedTasks = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (error) {
            console.error("Failed to parse line:", line, error);
            return null;
          }
        })
        .filter(Boolean) as TaskData[];

      const existingUids = new Set(tasks.map((task) => task.uid));
      const uniqueTasks = parsedTasks.filter(
        (task) => !existingUids.has(task.uid),
      );

      setTasks((prevTasks) => [...uniqueTasks, ...prevTasks]);
      setSelectedTask(null);
      setEditingPart(null);

      // Reset the file input
      event.target.value = "";
    } catch (error) {
      console.error("Failed to read file:", error);
      alert("Failed to read file. Please make sure it's a valid JSONL file.");
    }
  };

  const handleEdit = (
    taskUid: string,
    messageIndex: number,
    partIndex: number | null,
    content: string,
    isEditingNew = false,
  ) => {
    setEditingPart({ taskUid, messageIndex, partIndex, isEditingNew });
    setEditedContent(content);
  };

  const handleSave = () => {
    if (!editingPart) return;

    const { taskUid, messageIndex, partIndex } = editingPart;
    const newTasks = tasks.map((task) => {
      if (task.uid === taskUid) {
        const newMessages = [...task.messages];
        const message = newMessages[messageIndex];

        if (partIndex === null) {
          // Editing string content - convert to structured format
          const newContent = [
            {
              type: "text" as const,
              text: editedContent,
            },
          ];
          newMessages[messageIndex] = { ...message, content: newContent };
        } else if (Array.isArray(message.content)) {
          // Editing array content - update specific part
          const newContent = [...message.content];
          newContent[partIndex] = {
            ...newContent[partIndex],
            newText: editedContent,
          };
          newMessages[messageIndex] = { ...message, content: newContent };
        }

        return { ...task, messages: newMessages };
      }
      return task;
    });

    setTasks(newTasks);
    const updatedSelectedTask =
      newTasks.find((task) => task.uid === selectedTask?.uid) || null;
    setSelectedTask(updatedSelectedTask);
    setEditingPart(null);
    setEditedContent("");
  };

  const handleCancel = () => {
    setEditingPart(null);
    setEditedContent("");
  };

  const handleToggleDeleteMessage = (taskUid: string, messageIndex: number) => {
    const newTasks = tasks.map((task) => {
      if (task.uid === taskUid) {
        const newMessages = [...task.messages];
        const message = newMessages[messageIndex];
        if (Array.isArray(message.content)) {
          // Check if any parts are currently deleted
          const hasDeletedParts = message.content.some(
            (part) => part.isDeleted,
          );
          // Toggle all parts - if any are deleted, restore all; if none are deleted, delete all
          const newContent = message.content.map((part) => ({
            ...part,
            isDeleted: !hasDeletedParts,
          }));
          newMessages[messageIndex] = { ...message, content: newContent };
          return { ...task, messages: newMessages };
        }
      }
      return task;
    });

    setTasks(newTasks);
    const updatedSelectedTask =
      newTasks.find((task) => task.uid === selectedTask?.uid) || null;
    setSelectedTask(updatedSelectedTask);
  };

  const handleVerifiedChange = (taskUid: string, verified: boolean) => {
    const newTasks = tasks.map((task) =>
      task.uid === taskUid ? { ...task, verified } : task,
    );
    setTasks(newTasks);
    if (selectedTask?.uid === taskUid) {
      setSelectedTask({ ...selectedTask, verified });
    }
  };

  const handleExcludedChange = (taskUid: string, excluded: boolean) => {
    const newTasks = tasks.map((task) =>
      task.uid === taskUid ? { ...task, excluded } : task,
    );
    setTasks(newTasks);
    if (selectedTask?.uid === taskUid) {
      setSelectedTask({ ...selectedTask, excluded });
    }
  };

  const handleRemovePart = (
    taskUid: string,
    messageIndex: number,
    partIndex: number,
  ) => {
    const newTasks = tasks.map((task) => {
      if (task.uid === taskUid) {
        const newMessages = [...task.messages];
        const message = newMessages[messageIndex];
        if (Array.isArray(message.content)) {
          const newContent = [...message.content];
          // Toggle the deleted state for this part
          newContent[partIndex] = {
            ...newContent[partIndex],
            isDeleted: !newContent[partIndex].isDeleted,
          };
          newMessages[messageIndex] = { ...message, content: newContent };
          return { ...task, messages: newMessages };
        }
      }
      return task;
    });

    setTasks(newTasks);
    const updatedSelectedTask =
      newTasks.find((task) => task.uid === selectedTask?.uid) || null;
    setSelectedTask(updatedSelectedTask);
  };

  const handleExport = () => {
    const jsonlContent = tasks.map((task) => JSON.stringify(task)).join("\n");
    navigator.clipboard.writeText(jsonlContent).then(
      () => {
        alert("Copied to clipboard!");
      },
      (err) => {
        console.error("Could not copy text: ", err);
        alert("Failed to copy to clipboard.");
      },
    );
  };

  const scrollToTop = () => {
    taskViewRef.current?.scrollToTop();
  };

  const scrollToBottom = () => {
    taskViewRef.current?.scrollToBottom();
  };

  return (
    <TaskViewProvider>
      <div className="flex h-screen flex-col bg-background">
        <header className="flex items-center justify-between gap-4 border-b bg-card p-4 shadow-sm">
          <FileControls
            onImport={handleImport}
            onExport={handleExport}
            onFileUpload={handleFileUpload}
            isExportDisabled={tasks.length === 0}
          />
          {selectedTask && (
            <TaskBar
              selectedTask={selectedTask}
              onVerifiedChange={handleVerifiedChange}
              onExcludedChange={handleExcludedChange}
              scrollToTop={scrollToTop}
              scrollToBottom={scrollToBottom}
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              isTocOpen={isTocOpen}
              toggleToc={() => setIsTocOpen(!isTocOpen)}
            />
          )}
        </header>
        <div className="flex flex-grow overflow-hidden">
          {isSidebarOpen && (
            <TaskList
              tasks={tasks}
              selectedTask={selectedTask}
              onSelectTask={setSelectedTask}
            />
          )}
          <div className="flex-1 overflow-y-auto bg-background px-4 py-4">
            {selectedTask ? (
              <TaskView
                ref={taskViewRef}
                key={selectedTask.uid}
                selectedTask={selectedTask}
                editingPart={editingPart}
                editedContent={editedContent}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onToggleDeleteMessage={handleToggleDeleteMessage}
                onRemovePart={handleRemovePart}
                onEditedContentChange={setEditedContent}
              />
            ) : (
              <p className="text-center text-muted-foreground">
                Import from clipboard to get started.
              </p>
            )}
          </div>
          {isTocOpen && selectedTask && (
            <div className="w-1/5 overflow-y-auto border-l bg-muted/30 p-4">
              <ResponseToc messages={selectedTask.messages} />
            </div>
          )}
        </div>
      </div>
    </TaskViewProvider>
  );
}

export default App;
