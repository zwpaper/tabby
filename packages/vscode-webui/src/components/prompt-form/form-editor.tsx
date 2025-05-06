import { vscodeHost } from "@/lib/vscode";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import {
  EditorContent,
  Extension,
  ReactRenderer,
  useEditor,
} from "@tiptap/react";
import { useEffect, useRef } from "react";
import tippy from "tippy.js";
import { PromptFormMentionExtension } from "./mention-extension";
import {
  MentionList,
  type MentionListActions,
  type MentionListProps,
} from "./mention-list";
import "./prompt-form.css";

// Custom keyboard shortcuts extension that handles Enter key behavior
function CustomEnterKeyHandler(
  formRef: React.RefObject<HTMLFormElement>,
  isLoadingRef: React.RefObject<boolean>,
) {
  return Extension.create({
    addKeyboardShortcuts() {
      return {
        "Shift-Enter": () => {
          return this.editor.commands.first(() => [
            () => this.editor.commands.newlineInCode(),
            () => this.editor.commands.createParagraphNear(),
            () => this.editor.commands.liftEmptyBlock(),
            () => this.editor.commands.splitBlock(),
          ]);
        },
        Enter: ({ editor }) => {
          const isMentionSuggestionActive =
            editor.isActive("mention") ||
            document.querySelector(".tippy-box") !== null;

          if (!isMentionSuggestionActive) {
            setTimeout(() => {
              if (isLoadingRef.current) return;
              if (!formRef.current) return;
              formRef.current.requestSubmit();
            }, 0);
            return true;
          }
          return false;
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
  autoFocus?: boolean;
  children?: React.ReactNode;
  onError?: (e: Error) => void;
  onPaste?: (e: ClipboardEvent) => void;
}

export function FormEditor({
  input,
  setInput,
  onSubmit,
  isLoading,
  children,
  formRef: externalFormRef,
  autoFocus = true,
  onPaste,
}: FormEditorProps) {
  const internalFormRef = useRef<HTMLFormElement>(null);
  const formRef = externalFormRef || internalFormRef;
  const isLoadingRef = useRef<boolean>(isLoading);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const wrappedOnSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    onSubmit(e);
  };

  const editor = useEditor(
    {
      extensions: [
        Document,
        Paragraph,
        Text,
        Placeholder.configure({
          placeholder: "Ask anything, @ to mention",
        }),
        CustomEnterKeyHandler(formRef, isLoadingRef),
        PromptFormMentionExtension.configure({
          suggestion: {
            char: "@",
            items: async ({ query }: { query: string }) => {
              // Fetch files and return { id, filepath }
              const files = await vscodeHost.listFilesInWorkspace({
                query,
              });
              return files.map((file) => ({
                id: file,
                filepath: file,
              }));
            },
            render: () => {
              let component: ReactRenderer<
                MentionListActions,
                MentionListProps
              >;
              let popup: Array<{ destroy: () => void; hide: () => void }>;

              // Fetch items function for MentionList
              const fetchItems = async (query?: string) => {
                const files = await vscodeHost.listFilesInWorkspace({
                  query: query || "",
                });
                return files.map((file) => ({ id: file, filepath: file }));
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
                onKeyDown: (props: unknown) => {
                  const keyProps = props as { event: KeyboardEvent };
                  if (keyProps.event.key === "Escape") {
                    popup[0].hide();
                    return true;
                  }

                  if (keyProps.event.key === "Enter") {
                    keyProps.event.stopPropagation();
                    keyProps.event.preventDefault();

                    // Call the onKeyDown method of the MentionList component
                    const result =
                      (
                        component.ref as {
                          onKeyDown: (props: unknown) => boolean;
                        }
                      )?.onKeyDown(props) ?? false;

                    return result;
                  }

                  return (
                    (
                      component.ref as {
                        onKeyDown: (props: unknown) => boolean;
                      }
                    )?.onKeyDown(props) ?? false
                  );
                },
              };
            },
          },
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "prose min-h-[3.5em] font-sans dark:prose-invert focus:outline-none prose-p:my-0",
        },
      },
      onUpdate(props) {
        const text = props.editor.getText();
        setInput(text);
      },
      onPaste: (e) => {
        onPaste?.(e);
      },
    },
    [],
  );

  // Update editor content when input changes
  useEffect(() => {
    if (editor && input !== editor.getText()) {
      editor.commands.setContent(input);
    }
  }, [editor, input]);

  // Auto focus the editor when the component is mounted
  useEffect(() => {
    if (autoFocus && editor) {
      editor.commands.focus();
    }
  }, [editor, autoFocus]);

  const focusEditor = () => {
    if (editor && !editor.isFocused) {
      editor.commands.focus();
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={wrappedOnSubmit}
      className="relative rounded-sm border border-[var(--input-border)] bg-input p-1 transition-color duration-300 focus-within:border-ring"
      onClick={(e) => {
        e.stopPropagation();
        focusEditor();
      }}
      onKeyDown={() => {
        // do nothing
      }}
    >
      <EditorContent
        editor={editor}
        className="prose !border-none max-h-32 min-h-20 w-full overflow-hidden overflow-y-auto break-words text-[var(--vscode-input-foreground)] focus:outline-none"
      />
      {children}
    </form>
  );
}

// Helper function to focus and set input
export function useEditorHelpers(editor: ReturnType<typeof useEditor>) {
  const focusEditor = () => {
    if (editor && !editor.isFocused) {
      editor.commands.focus();
    }
  };

  const setInputAndFocus = (
    input: string,
    setInput: (text: string) => void,
  ) => {
    setInput(input);
    if (editor) {
      editor.commands.focus();
    }
  };

  return { focusEditor, setInputAndFocus };
}
