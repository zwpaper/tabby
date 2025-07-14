export type Part =
  | string
  | Array<{
      type: "text";
      text: string;
    }>;

export interface Message {
  role: "system" | "user" | "assistant";
  content: Part;
}

export interface TaskData {
  uid: string;
  messages: Array<Message>;
  verified?: boolean;
  excluded?: boolean;
}
