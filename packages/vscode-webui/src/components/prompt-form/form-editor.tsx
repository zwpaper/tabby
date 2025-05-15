import { vscodeHost } from "@/lib/vscode";
import Document from "@tiptap/extension-document";
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
import { useEffect, useRef } from "react";
import tippy from "tippy.js";
import { PromptFormMentionExtension } from "./mention-extension";
import {
  MentionList,
  type MentionListActions,
  type MentionListProps,
} from "./mention-list";
import "./prompt-form.css";
import { debounceWithCachedValue } from "@/lib/debounce";
import { useActiveTabs } from "@/lib/hooks/use-active-tabs";
import uFuzzy from "@leeoniya/ufuzzy";

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
  editorRef?: React.MutableRefObject<Editor | null>;
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
  editorRef,
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

  const activeTabs = useActiveTabs();
  const activeTabsRef = useRef(activeTabs);
  useEffect(() => {
    activeTabsRef.current = activeTabs;
  }, [activeTabs]);

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
              const data = await debouncedListWorkspaceFiles();
              if (!data) return [];

              return fuzzySearch(query, {
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

                return fuzzySearch(query, {
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
            "prose min-h-[3.5em] font-sans dark:prose-invert focus:outline-none prose-p:my-0 leading-[1.25]",
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

  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

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
        className="prose !border-none max-h-32 min-h-20 w-full max-w-none overflow-hidden overflow-y-auto break-words text-[var(--vscode-input-foreground)] focus:outline-none"
      />
      {children}
    </form>
  );
}

function fuzzySearch(
  needle: string | undefined,
  data: {
    haystack: string[];
    files: { filepath: string; isDir: boolean }[];
    activeTabs?: { filepath: string; isDir: boolean }[];
  },
): { filepath: string; isDir: boolean }[] {
  const activeTabsSet = new Set(data.activeTabs?.map((d) => d.filepath) || []);

  const uniqueFilesMap = new Map<
    string,
    { filepath: string; isDir: boolean }
  >();

  for (const file of data.files) {
    uniqueFilesMap.set(file.filepath, file);
  }

  if (data.activeTabs) {
    for (const tab of data.activeTabs) {
      uniqueFilesMap.set(tab.filepath, tab);
    }
  }

  if (!needle) {
    const MAX_RESULTS = 500;
    const allResults = Array.from(uniqueFilesMap.values());

    return sortResultsByActiveTabs(allResults, activeTabsSet).slice(
      0,
      MAX_RESULTS,
    );
  }

  const allFilepaths = new Set(data.haystack);

  if (data.activeTabs) {
    for (const tab of data.activeTabs) {
      allFilepaths.add(tab.filepath);
    }
  }

  const uf = new uFuzzy({});
  const haystackArray = Array.from(allFilepaths);
  const [_, info, order] = uf.search(haystackArray, needle);

  if (!order) return [];

  const searchResultsMap = new Map<
    string,
    { filepath: string; isDir: boolean }
  >();

  for (const i of order) {
    const filepath = haystackArray[info.idx[i]];
    const file = uniqueFilesMap.get(filepath);
    if (file) {
      searchResultsMap.set(filepath, file);
    }
  }

  return sortResultsByActiveTabs(
    Array.from(searchResultsMap.values()),
    activeTabsSet,
  );
}

function sortResultsByActiveTabs<T extends { filepath: string }>(
  results: T[],
  activeTabsSet: Set<string>,
): T[] {
  const activeResults: T[] = [];
  const normalResults: T[] = [];

  for (const result of results) {
    if (activeTabsSet.has(result.filepath)) {
      activeResults.push(result);
    } else {
      normalResults.push(result);
    }
  }

  return [...activeResults, ...normalResults];
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
