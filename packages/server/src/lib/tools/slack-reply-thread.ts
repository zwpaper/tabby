import { ServerTools, defineServerTool } from "@ragdoll/tools";
import type { User } from "../../auth";
import { slackService } from "../../service/slack";

// Define the slackReplyThread tool using defineServerTool
export const slackReplyThreadImpl = defineServerTool({
  tool: ServerTools.slackReplyThread,
  makeExecuteFn: (user: User) => {
    return async ({ integrationId, channel, threadTs, text }) => {
      const slackIntegration = await slackService.getIntegration(
        user.id,
        integrationId,
      );
      if (!slackIntegration) {
        throw new Error("Slack client not found");
      }
      const { webClient } = slackIntegration;
      const result = await webClient.chat.postMessage({
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
