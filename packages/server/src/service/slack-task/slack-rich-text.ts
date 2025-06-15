import type { AnyBlock } from "@slack/web-api";

class SlackRichTextRenderer {
  renderTaskCreated(
    prompt: string,
    githubRepository: { owner: string; repo: string },
  ): AnyBlock[] {
    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🐱 Task Created for project ${githubRepository.owner}/${githubRepository.repo}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💬 Query:* ${prompt}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Status:* 🟢 Initializing",
          },
          {
            type: "mrkdwn",
            text: `*Started:* ${new Date().toLocaleTimeString()}`,
          },
        ],
      },
    ];
  }

  renderTaskStarting(prompt: string): AnyBlock[] {
    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚀 Task Starting",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💬 Query:* ${prompt}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Status:* 🟢 Starting",
          },
          {
            type: "mrkdwn",
            text: `*Started:* ${new Date().toLocaleTimeString()}`,
          },
        ],
      },
    ];
  }

  renderTaskRunning(
    prompt: string,
    toolDescription: string,
    elapsed: string,
  ): AnyBlock[] {
    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⚡ Task Running",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💬 Query:* ${prompt}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Status:* 🟡 ${toolDescription}`,
          },
          {
            type: "mrkdwn",
            text: `*Runtime:* ${elapsed}`,
          },
        ],
      },
    ];
  }

  renderTaskWaitingInput(prompt: string, elapsed: string): AnyBlock[] {
    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⏸️ Waiting for Input",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💬 Query:* ${prompt}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Status:* ⏸️ Pending input",
          },
          {
            type: "mrkdwn",
            text: `*Waiting:* ${elapsed}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "👤 *Required:* Waiting for user to continue the task",
        },
      },
    ];
  }

  renderTaskComplete(
    prompt: string,
    elapsed: string,
    result: string,
  ): AnyBlock[] {
    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "✅ Task Complete",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💬 Query:* ${prompt}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Status:* ✅ Complete",
          },
          {
            type: "mrkdwn",
            text: `*Duration:* ${elapsed}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📋 Result:* ${result}`,
        },
      },
    ];
  }

  renderTaskFailed(
    prompt: string,
    elapsed: string,
    errorMessage: string,
  ): AnyBlock[] {
    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "❌ Task Failed",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💬 Query:* ${prompt}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Status:* ❌ Failed",
          },
          {
            type: "mrkdwn",
            text: `*Duration:* ${elapsed}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🚨 Error:* ${errorMessage}`,
        },
      },
    ];
  }

  renderCloudRunnerSuccess(serverUrl: string): AnyBlock[] {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *Cloud runner started successfully!*",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "🔗 Open Web VSCode",
            },
            url: serverUrl.startsWith("http")
              ? serverUrl
              : `https://${serverUrl}`,
            style: "primary",
            value: "open_server",
          },
        ],
      },
    ];
  }
}

export const slackRichTextRenderer = new SlackRichTextRenderer();
