import Mention from "@tiptap/extension-mention";
import { PluginKey } from "@tiptap/pm/state";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";

/**
 * A React component to render a workflow node in the editor.
 * Displays the workflow with a / symbol in a highlighted style.
 */
export const WorkflowComponent = (props: NodeViewProps) => {
  const { node } = props;
  const { name } = node.attrs;

  return (
    <NodeViewWrapper as="span" className="rounded-sm px-1">
      <span className="space-x-0.5 rounded bg-muted box-decoration-clone px-1.5 py-0.5 align-middle font-medium text-foreground text-sm">
        /{name}
      </span>
    </NodeViewWrapper>
  );
};

// Create a unique plugin key for workflow suggestions
export const workflowMentionPluginKey = new PluginKey(
  "workflowMentionPluginKey",
);

/**
 * A custom TipTap extension to handle workflows (like /workflow-name).
 */
export const PromptFormWorkflowExtension = Mention.extend({
  name: "workflowMention",
  addNodeView() {
    return ReactNodeViewRenderer(WorkflowComponent);
  },

  renderText({ node }) {
    const { name } = node.attrs;
    const content = node.attrs.content || "error loading workflow";

    const safeContent = content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    return `<workflow content="${safeContent}">${name}</workflow>`;
  },

  addAttributes() {
    return {
      id: {
        default: "",
      },
      name: {
        default: "",
      },
      // the content of the workflow file
      content: {
        default: "",
      },
    };
  },
});
