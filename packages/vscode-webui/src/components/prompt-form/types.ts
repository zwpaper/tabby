import type { EditorState, Transaction } from "@tiptap/pm/state";

/**
 * TipTap command props
 */
export interface CommandProps {
  tr: Transaction;
  state: EditorState;
  [key: string]: unknown;
}
