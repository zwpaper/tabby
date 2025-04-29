import Mention from "@tiptap/extension-mention";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";

/**
 * A React component to render a mention node in the editor.
 * Displays the mention with an @ symbol in a highlighted style.
 */
export const MentionComponent = (props: NodeViewProps) => {
  const { node } = props;
  const { filepath } = node.attrs;

  // Extract basename for display
  const separator = filepath.includes("\\") ? "\\" : "/";
  const basename = filepath.split(separator).pop() || filepath;

  return (
    <NodeViewWrapper as="span" className="rounded-sm px-1">
      <span className="space-x-0.5 whitespace-nowrap rounded bg-muted px-1.5 py-0.5 align-middle text-sm font-medium text-foreground">
        @{basename}
      </span>
    </NodeViewWrapper>
  );
};

/**
 * A custom TipTap extension to handle mentions (like @name).
 */
export const PromptFormMentionExtension = Mention.extend({
  // Uses ReactNodeViewRenderer for custom node rendering
  addNodeView() {
    return ReactNodeViewRenderer(MentionComponent);
  },

  // When exported as plain text, use a placeholder format
  renderText({ node }) {
    return `[file:${node.attrs.filepath}]`;
  },

  // Defines custom attributes for the mention node
  addAttributes() {
    return {
      id: {
        default: null,
      },
      filepath: {
        default: "",
      },
    };
  },
});
