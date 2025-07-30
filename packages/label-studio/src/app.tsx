import { useRef, useState } from "react";
import { FileControls } from "./components/file-controls";
import { ImportTasksModal } from "./components/import-tasks-modal";
import { PreviewModal } from "./components/preview-modal";
import { ResponseToc } from "./components/response-toc";
import { TaskBar } from "./components/task-bar";
import { TaskList } from "./components/task-list";
import { TaskView, type TaskViewHandle } from "./components/task-view";
import { TaskViewProvider } from "./contexts/task-view-context";
import { fetchTask } from "./lib/task-fetcher";
import { type TaskData, ZodCompatibleTaskDataType, toTaskData } from "./types";

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
  const [previewModalState, setPreviewModalState] = useState<{
    isOpen: boolean;
    content: string;
    language: "text" | "custom";
    taskUid: string | null;
    messageIndex: number | null;
    partIndex: number | null;
  }>({
    isOpen: false,
    content: "",
    language: "text",
    taskUid: null,
    messageIndex: null,
    partIndex: null,
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [isImportTasksModalOpen, setIsImportTasksModalOpen] = useState(false);
  const taskViewRef = useRef<TaskViewHandle>(null);

  const handleImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const lines = text.trim().split("\n");
        let errorCount = 0;
        const parsedTasks = lines
          .map((line, index) => {
            try {
              return toTaskData(
                ZodCompatibleTaskDataType.parse(JSON.parse(line)),
              );
            } catch (error) {
              errorCount++;
              console.error(`Failed to parse line ${index}:`, error);
              return null;
            }
          })
          .filter((task): task is TaskData => task !== null);
        const existingUids = new Set(tasks.map((task) => task.uid));
        const uniqueTasks = parsedTasks.filter(
          (task) => !existingUids.has(task.uid),
        );
        setTasks((prevTasks) => [...uniqueTasks, ...prevTasks]);
        setSelectedTask(null);
        setEditingPart(null);

        if (errorCount > 0) {
          alert(
            `Successfully imported ${uniqueTasks.length} tasks. ${errorCount} lines failed to parse. Check the console for details.`,
          );
        }
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
      let errorCount = 0;
      const parsedTasks = lines
        .map((line, index) => {
          try {
            return toTaskData(
              ZodCompatibleTaskDataType.parse(JSON.parse(line)),
            );
          } catch (error) {
            errorCount++;
            console.error(`Failed to parse line ${index}:`, error);
            return null;
          }
        })
        .filter((task): task is TaskData => task !== null);

      const existingUids = new Set(tasks.map((task) => task.uid));
      const uniqueTasks = parsedTasks.filter(
        (task) => !existingUids.has(task.uid),
      );

      setTasks((prevTasks) => [...uniqueTasks, ...prevTasks]);
      setSelectedTask(null);
      setEditingPart(null);

      if (errorCount > 0) {
        alert(
          `Successfully imported ${uniqueTasks.length} tasks. ${errorCount} lines failed to parse. Check the console for details.`,
        );
      }

      // Reset the file input
      event.target.value = "";
    } catch (error) {
      console.error("Failed to read file:", error);
      alert("Failed to read file. Please make sure it's a valid JSONL file.");
    }
  };

  const openImportTasksModal = () => {
    setIsImportTasksModalOpen(true);
  };

  const handleImportTasks = async ({
    content,
    auth,
  }: { content: string; auth: string }) => {
    try {
      const inputTaskUids = content
        .trim()
        .split(/[\n\s,;]+/)
        .filter(Boolean)
        .map((item) => {
          if (item.includes("/")) {
            const url = new URL(item);
            return url.pathname.split("/").pop() ?? "";
          }
          return item;
        })
        .filter(Boolean)
        .filter((uid, idx, arr) => arr.indexOf(uid) === idx); // dedup

      const existingTaskUids = new Set(tasks.map((task) => task.uid));
      const skippedTasks = inputTaskUids.filter((uid) =>
        existingTaskUids.has(uid),
      );
      if (skippedTasks.length > 0) {
        alert(
          `Will skip ${skippedTasks.length} duplicate tasks: ${skippedTasks.join(", ")}`,
        );
      }

      const newTaskUids = inputTaskUids.filter(
        (uid) => !existingTaskUids.has(uid),
      );
      const newTasks: TaskData[] = [];
      let errorCount = 0;

      for (const uid of newTaskUids) {
        try {
          const task = await fetchTask(uid, auth);
          newTasks.push(task);
        } catch (error) {
          errorCount++;
          console.error(`Failed to import task ${uid}:`, error);
        }
      }

      setTasks((prevTasks) => [...newTasks, ...prevTasks]);
      setSelectedTask(null);
      setEditingPart(null);

      if (errorCount > 0) {
        alert(
          `Successfully imported ${newTasks.length} tasks, but failed to import ${errorCount} tasks. Please check the console for more details.`,
        );
      } else {
        alert(`Successfully imported ${newTasks.length} tasks!`);
      }
    } catch (error) {
      console.error("Failed to import tasks:", error);
      alert("Failed to import tasks. Please the console for more details.");
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

  const handlePreview = (
    taskUid: string,
    messageIndex: number,
    partIndex: number,
    content: string,
  ) => {
    let language: "text" | "custom" = content.startsWith("<")
      ? "custom"
      : "text";
    let displayContent = content;

    if (language === "custom") {
      try {
        const firstAngleBracket = content.indexOf(">");
        const lastClosingTag = content.lastIndexOf("</");

        if (firstAngleBracket !== -1 && lastClosingTag !== -1) {
          const jsonString = content.substring(
            firstAngleBracket + 1,
            lastClosingTag,
          );
          const jsonContent = JSON.parse(jsonString);
          displayContent = JSON.stringify(jsonContent, null, 2);
        } else {
          language = "text";
        }
      } catch (error) {
        language = "text";
        console.log("Setting language to text due to error:", error);
      }
    }

    setPreviewModalState({
      isOpen: true,
      content: displayContent,
      language,
      taskUid,
      messageIndex,
      partIndex,
    });
  };

  const handleClosePreview = () => {
    setPreviewModalState({
      isOpen: false,
      content: "",
      language: "text",
      taskUid: null,
      messageIndex: null,
      partIndex: null,
    });
  };

  const handleSavePreview = (newContent: string) => {
    const { taskUid, messageIndex, partIndex, language } = previewModalState;
    if (partIndex === null || messageIndex === null || taskUid === null) return;

    const newTasks = tasks.map((task) => {
      if (task.uid === taskUid) {
        const newMessages = [...task.messages];
        const message = newMessages[messageIndex];
        if (Array.isArray(message.content)) {
          const newContentArray = [...message.content];
          const part = newContentArray[partIndex];

          let finalContent = newContent;
          if (language === "custom") {
            try {
              const jsonContent = JSON.parse(newContent);
              const originalContent =
                task.messages[messageIndex]?.content[partIndex]?.text ?? "";

              const firstAngleBracket = originalContent.indexOf(">");
              const lastClosingTag = originalContent.lastIndexOf("</");

              if (firstAngleBracket !== -1 && lastClosingTag !== -1) {
                const openingTag = originalContent.substring(
                  0,
                  firstAngleBracket + 1,
                );
                const closingTag = originalContent.substring(lastClosingTag);
                finalContent = `${openingTag}${JSON.stringify(jsonContent)}${closingTag}`;
              } else {
                // Fallback for safety
                finalContent = newContent;
              }
            } catch (error) {
              // If parsing fails, save the raw content
              finalContent = newContent;
            }
          }
          newContentArray[partIndex] = {
            ...part,
            newText: finalContent,
          };
          newMessages[messageIndex] = { ...message, content: newContentArray };
        }
        return { ...task, messages: newMessages };
      }
      return task;
    });

    setTasks(newTasks);
    const updatedSelectedTask =
      newTasks.find((task) => task.uid === selectedTask?.uid) || null;
    setSelectedTask(updatedSelectedTask);
    handleClosePreview();
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
            onImportTasks={openImportTasksModal}
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
                onPreview={handlePreview}
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

        <ImportTasksModal
          isOpen={isImportTasksModalOpen}
          onClose={() => setIsImportTasksModalOpen(false)}
          onImport={handleImportTasks}
        />

        <PreviewModal
          isOpen={previewModalState.isOpen}
          onClose={handleClosePreview}
          content={previewModalState.content}
          onSave={handleSavePreview}
          language={previewModalState.language}
        />
      </div>
    </TaskViewProvider>
  );
}

export default App;
