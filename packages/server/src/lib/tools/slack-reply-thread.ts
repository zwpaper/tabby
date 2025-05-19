import { ServerTools, defineServerTool } from "@ragdoll/tools";
import type { User } from "../../auth";
import slack from "../../slack";

// Define the slackReplyThread tool using defineServerTool
export const slackReplyThreadImpl = defineServerTool({
  tool: ServerTools.slackReplyThread,
  makeExecuteFn: (user: User) => {
    return async ({ integrationId, channel, threadTs, text }) => {
      const client = await slack.getWebClient(user.id, integrationId);
      const result = await client.chat.postMessage({
        thread_ts: threadTs,
        channel,
        text,
      });
      if (result.ts) {
        return {
          ts: result.ts,
        };
      }
      throw new Error(result.error);
    };
  },
});
