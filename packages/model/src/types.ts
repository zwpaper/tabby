export type Part = Array<{
  type: "text";
  text: string;
  newText?: string;
  isDeleted?: boolean;
}>;

export interface Message {
  role: "system" | "user" | "assistant";
  content: Part;
  isDeleted?: boolean;
}

export interface TaskData {
  uid: string;
  messages: Array<Message>;
  verified?: boolean;
  excluded?: boolean;
}
