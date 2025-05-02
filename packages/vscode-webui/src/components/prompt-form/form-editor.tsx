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
function CustomEnterKeyHandler(doSubmit: () => void) {
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
            doSubmit();
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
}

export function FormEditor({
  input,
  setInput,
  onSubmit,
  isLoading,
  formRef: externalFormRef,
  autoFocus = true,
}: FormEditorProps) {
  const internalFormRef = useRef<HTMLFormElement>(null);
  const formRef = externalFormRef || internalFormRef;

  const doSubmit = () => {
    if (isLoading || !editor || editor.isEmpty) return;
    formRef.current?.requestSubmit();
  };

  // Set up the TipTap editor with mention extension
  const editor = useEditor(
    {
      extensions: [
        Document,
        Paragraph,
        Text,
        Placeholder.configure({
          placeholder: "Ask anything, @ to mention",
        }),
        CustomEnterKeyHandler(doSubmit),
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
                  if (customExtension) {
                    // @ts-ignore - method exists but TypeScript doesn't know
                    customExtension.setMentionListActive(true);
                  }

                  popup = tippy("body", {
                    getReferenceClientRect: tiptapProps.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "top-start",
                    maxWidth: "none",
                    onHide: () => {
                      if (customExtension) {
                        // @ts-ignore - method exists but TypeScript doesn't know
                        customExtension.setMentionListActive(false);
                      }
                    },
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

  const wrappedOnSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    onSubmit(e);
    if (editor && !editor.isEmpty) {
      setTimeout(() => editor.commands.clearContent(), 0);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={wrappedOnSubmit}
      className="bg-input p-1 rounded-sm border border-[var(--input-border)] focus-within:border-ring transition-color duration-300"
      onClick={(e) => {
        e.stopPropagation();
        focusEditor();
      }}
      onKeyDown={() => {}}
    >
      <EditorContent
        editor={editor}
        className="min-h-20 max-h-32 w-full overflow-y-auto prose overflow-hidden break-words text-[var(--vscode-input-foreground)] focus:outline-none !border-none"
      />
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
