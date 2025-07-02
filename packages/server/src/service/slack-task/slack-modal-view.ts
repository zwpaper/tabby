import type { View } from "@slack/web-api";

class SlackModalViewRenderer {
  renderFollowupModal(
    taskId: string,
    metadata: { channel: string; messageTs: string },
    prefillContent?: string,
  ): View {
    return {
      type: "modal",
      callback_id: `submit_followup_${taskId}`,
      private_metadata: JSON.stringify(metadata),
      title: {
        type: "plain_text",
        text: "Reply to Pochi",
      },
      submit: {
        type: "plain_text",
        text: "Submit",
      },
      close: {
        type: "plain_text",
        text: "Cancel",
      },
      blocks: [
        {
          type: "input",
          block_id: "answer_block",
          element: {
            type: "plain_text_input",
            action_id: "answer_input",
            multiline: true,
            placeholder: {
              type: "plain_text",
              text: "Enter your reply here...",
            },
            ...(prefillContent && { initial_value: prefillContent }),
          },
          label: {
            type: "plain_text",
            text: "Your Reply",
          },
        },
      ],
    };
  }
}

export const slackModalViewRenderer = new SlackModalViewRenderer();
