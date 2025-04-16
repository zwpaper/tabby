import type { Tool } from "ai";
import type { User } from "../../auth";
import { slackReplyThread } from "./slack-reply-thread";

export const MakeServerTools: Record<string, (ctx: User) => Tool> = {
  slackReplyThread,
};
