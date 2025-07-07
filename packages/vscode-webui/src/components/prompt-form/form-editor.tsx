import { debounceWithCachedValue } from "@/lib/debounce";
import { fuzzySearchFiles, fuzzySearchWorkflows } from "@/lib/fuzzy-search";
import { useActiveTabs } from "@/lib/hooks/use-active-tabs";
import { vscodeHost } from "@/lib/vscode";
import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import {
  type Editor,
  EditorContent,
  Extension,
  ReactRenderer,
  useEditor,
} from "@tiptap/react";
import { useCallback, useEffect, useRef } from "react";
import tippy from "tippy.js";
import {
  PromptFormMentionExtension,
  fileMentionPluginKey,
} from "./context-mention/extension";
import {
  MentionList,
  type MentionListProps,
} from "./context-mention/mention-list";
import "./prompt-form.css";
import { cn } from "@/lib/utils";
import {
  type SuggestionMatch,
  type Trigger,
  findSuggestionMatch,
} from "@tiptap/suggestion";
import type { MentionListActions } from "./shared";
import { SubmitHistoryExtension } from "./submit-history-extension";
import {
  PromptFormWorkflowExtension,
  workflowMentionPluginKey,
} from "./workflow-mention/extension";
import {
  type WorkflowListProps,
  WorkflowMentionList,
} from "./workflow-mention/mention-list";

const newLineCharacter = "\n";

// Custom keyboard shortcuts extension that handles Enter key behavior
function CustomEnterKeyHandler(formRef: React.RefObject<HTMLFormElement>) {
  return Extension.create({
    addKeyboardShortcuts() {
      return {
        "Shift-Enter": () => {
          return this.editor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock(),
          ]);
        },
        Enter: () => {
          if (formRef.current) {
            formRef.current.requestSubmit();
          }
          return true;
        },
      };
    },
  });
}

interface FormEditorProps {
  input: string;
  setInput: (text: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  formRef?: React.RefObject<HTMLFormElement>;
  editorRef?: React.MutableRefObject<Editor | null>;
  autoFocus?: boolean;
  children?: React.ReactNode;
  onError?: (e: Error) => void;
  onPaste?: (e: ClipboardEvent) => void;
  enableSubmitHistory?: boolean;
}

export function FormEditor({
  input,
  setInput,
  onSubmit,
  isLoading,
  children,
  formRef: externalFormRef,
  editorRef,
  autoFocus = true,
  onPaste,
  enableSubmitHistory = true,
}: FormEditorProps) {
  const internalFormRef = useRef<HTMLFormElement>(null);
  const formRef = externalFormRef || internalFormRef;

  const activeTabs = useActiveTabs();
  const activeTabsRef = useRef(activeTabs);
  useEffect(() => {
    activeTabsRef.current = activeTabs;
  }, [activeTabs]);
  const isComposingRef = useRef(false);
  const editor = useEditor(
    {
      extensions: [
        Document,
        Paragraph,
        Text,
        Placeholder.configure({
          placeholder: "Ask anything ...",
        }),
        CustomEnterKeyHandler(formRef),
        PromptFormMentionExtension.configure({
          suggestion: {
            char: "@",
            pluginKey: fileMentionPluginKey,
            items: async ({ query }: { query: string }) => {
              const data = await debouncedListWorkspaceFiles();
              if (!data) return [];

              return fuzzySearchFiles(query, {
                files: data.files,
                haystack: data.haystack,
                activeTabs: activeTabsRef.current,
              });
            },
            render: () => {
              let component: ReactRenderer<
                MentionListActions,
                MentionListProps
              >;
              let popup: Array<{ destroy: () => void; hide: () => void }>;

              // Fetch items function for MentionList
              const fetchItems = async (query?: string) => {
                const data = await debouncedListWorkspaceFiles();
                if (!data) return [];

                return fuzzySearchFiles(query, {
                  files: data.files,
                  haystack: data.haystack,
                  activeTabs: activeTabsRef.current,
                });
              };

              return {
                onStart: (props) => {
                  const tiptapProps = props as {
                    editor: unknown;
                    clientRect?: () => DOMRect;
                  };

                  component = new ReactRenderer(MentionList, {
                    props: {
                      ...props,
                      fetchItems,
                    },
                    editor: props.editor,
                  });

                  if (!tiptapProps.clientRect) {
                    return;
                  }

                  // @ts-ignore - accessing extensionManager and methods
                  const customExtension =
                    props.editor.extensionManager?.extensions.find(
                      // @ts-ignore - extension type
                      (extension) =>
                        extension.name === "custom-enter-key-handler",
                    );

                  popup = tippy("body", {
                    getReferenceClientRect: tiptapProps.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "top-start",
                    offset: [0, 6],
                    maxWidth: "none",
                  });
                },
                onUpdate: (props) => {
                  isComposingRef.current = props.editor.view.composing;
                  component.updateProps(props);
                },
                onExit: () => {
                  popup[0].destroy();
                  component.destroy();
                },
                onKeyDown: (props) => {
                  if (props.event.key === "Escape") {
                    popup[0].hide();
                    return true;
                  }

                  return component.ref?.onKeyDown(props) ?? false;
                },
              };
            },
            findSuggestionMatch: (config: Trigger): SuggestionMatch => {
              return findSuggestionMatch({
                ...config,
                allowSpaces: isComposingRef.current,
              });
            },
          },
        }),
        // Use the already configured PromptFormWorkflowExtension
        PromptFormWorkflowExtension.configure({
          suggestion: {
            char: "/",
            pluginKey: workflowMentionPluginKey,
            items: async ({ query }: { query: string }) => {
              const data = await debouncedListWorkflows();
              if (!data) return [];

              const workflowResults = fuzzySearchWorkflows(
                query,
                data.workflows,
              );

              return workflowResults;
            },
            render: () => {
              let component: ReactRenderer<
                MentionListActions,
                WorkflowListProps
              >;
              let popup: Array<{ destroy: () => void; hide: () => void }>;

              // Fetch items function for WorkflowList
              const fetchItems = async (query?: string) => {
                const data = await debouncedListWorkflows();
                if (!data) return [];
                const workflowResults = fuzzySearchWorkflows(
                  query,
                  data.workflows,
                );
                return workflowResults;
              };

              return {
                onStart: (props) => {
                  const tiptapProps = props as {
                    editor: unknown;
                    clientRect?: () => DOMRect;
                  };

                  component = new ReactRenderer(WorkflowMentionList, {
                    props: {
                      ...props,
                      fetchItems,
                    },
                    editor: props.editor,
                  });

                  if (!tiptapProps.clientRect) {
                    return;
                  }

                  popup = tippy("body", {
                    getReferenceClientRect: tiptapProps.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "top-start",
                    offset: [0, 6],
                    maxWidth: "none",
                  });
                },
                onUpdate: (props) => {
                  component.updateProps(props);
                },
                onExit: () => {
                  popup[0].destroy();
                  component.destroy();
                },
                onKeyDown: (props) => {
                  if (props.event.key === "Escape") {
                    popup[0].hide();
                    return true;
                  }

                  return component.ref?.onKeyDown(props) ?? false;
                },
              };
            },
            findSuggestionMatch: (config: Trigger): SuggestionMatch => {
              return findSuggestionMatch({
                ...config,
                allowSpaces: isComposingRef.current,
              });
            },
          },
        }),
        History.configure({
          depth: 20,
        }),
        ...(enableSubmitHistory ? [SubmitHistoryExtension] : []),
      ],
      editorProps: {
        attributes: {
          class:
            "prose max-w-full min-h-[3.5em] font-sans dark:prose-invert focus:outline-none prose-p:my-0 leading-[1.25]",
        },
      },
      onUpdate(props) {
        const text = props.editor.getText({
          blockSeparator: newLineCharacter,
        });
        if (text !== input) {
          setInput(text);
        }

        // Update current draft if we have submit history enabled
        if (
          enableSubmitHistory &&
          props.editor.extensionManager.extensions.find(
            (ext) => ext.name === "submitHistory",
          )
        ) {
          props.editor.commands.updateCurrentDraft(
            JSON.stringify(props.editor.getJSON()),
          );
        }

        // Save content when changes
        debouncedSaveEditorState();
      },
      onDestroy() {
        // Save content when editor is destroyed
        saveEdtiorState();
      },
      onPaste: (e) => {
        onPaste?.(e);
      },
    },
    [],
  );

  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  // For saving the editor content to the session state
  const saveEdtiorState = useCallback(async () => {
    if (editor && !editor.isDestroyed) {
      await vscodeHost.setSessionState({
        input: JSON.stringify(editor.getJSON()),
      });
    }
    return null;
  }, [editor]);

  const debouncedSaveEditorState = useCallback(
    debounceWithCachedValue(saveEdtiorState, 500, { trailing: true }),
    [],
  );

  // Load session state when the editor is initialized
  useEffect(() => {
    if (!editor) {
      return;
    }
    const loadSessionState = async () => {
      const sessionState = await vscodeHost.getSessionState(["input"]);
      if (sessionState.input) {
        try {
          const content = JSON.parse(sessionState.input);
          editor.commands.setContent(content, true);
        } catch (error) {
          // ignore JSON parse errors
        }
      }
    };
    loadSessionState();
  }, [editor]);

  // Update editor content when input changes
  useEffect(() => {
    if (
      editor &&
      input !== editor.getText({ blockSeparator: newLineCharacter })
    ) {
      editor.commands.setContent(input, true);
    }
  }, [editor, input]);

  // Auto focus the editor when the component is mounted
  useEffect(() => {
    if (autoFocus && editor) {
      editor.commands.focus();
    }
  }, [editor, autoFocus]);

  const focusEditor = useCallback(() => {
    if (editor && !editor.isFocused) {
      editor.commands.focus();
    }
  }, [editor]);

  // Auto focus when document is focused.
  useEffect(() => {
    window.addEventListener("focus", focusEditor);
    return () => {
      window.removeEventListener("focus", focusEditor);
    };
  }, [focusEditor]);

  // Handle form submission to record submit history
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      if (enableSubmitHistory && editor && !editor.isDestroyed) {
        editor.commands.addToSubmitHistory(JSON.stringify(editor.getJSON()));
      }
      onSubmit(e);
    },
    [enableSubmitHistory, editor, onSubmit],
  );

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={cn(
        "relative rounded-sm border border-[var(--input-border)] bg-input p-1 transition-color duration-300 focus-within:border-ring",
        {
          "form-editor-loading": isLoading,
        },
      )}
      onClick={(e) => {
        e.stopPropagation();
        focusEditor();
      }}
      onKeyDown={() => {
        // do nothing
      }}
    >
      {children}
      <EditorContent
        editor={editor}
        className="prose !border-none max-h-32 min-h-20 w-full max-w-none overflow-hidden overflow-y-auto break-words text-[var(--vscode-input-foreground)] focus:outline-none"
      />
    </form>
  );
}

const debouncedListWorkspaceFiles = debounceWithCachedValue(
  async () => {
    const files = await vscodeHost.listFilesInWorkspace();
    return {
      files,
      haystack: files.map((f) => f.filepath),
    };
  },
  1000 * 60, // 1 minute
  {
    leading: true,
  },
);

export const debouncedListWorkflows = debounceWithCachedValue(
  async () => {
    const workflows = await vscodeHost.listWorkflowsInWorkspace();
    return {
      workflows,
    };
  },
  1000 * 60,
  {
    leading: true,
  },
);
