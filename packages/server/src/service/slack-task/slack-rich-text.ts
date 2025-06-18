import type { Todo } from "@ragdoll/db";
import type { AnyBlock } from "@slack/web-api";

const PreparingTaskBlock = {
  type: "section",
  text: {
    type: "mrkdwn",
    text: "*🟢 Preparing* remote environment for Pochi ...",
  },
};

class SlackRichTextRenderer {
  renderTaskCreated(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
  ): AnyBlock[] {
    return [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      PreparingTaskBlock,
    ];
  }

  renderTaskStarting(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    todos?: Todo[],
    messagesCount?: number,
    totalTokens?: number,
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      PreparingTaskBlock,
    ];

    this.renderTodoListBlock(blocks, todos);

    this.renderFooterBlock(blocks, taskId, messagesCount, totalTokens);

    return blocks;
  }

  renderTaskPendingTool(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    todos?: Todo[],
    messagesCount?: number,
    totalTokens?: number,
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🟡 Running*",
        },
      },
    ];

    this.renderTodoListBlock(blocks, todos);

    this.renderFooterBlock(blocks, taskId, messagesCount, totalTokens);

    return blocks;
  }

  renderTaskAskFollowUpQuestion(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    waitingReason: string,
    followUpSuggestions?: string[],
    todos?: Todo[],
    messagesCount?: number,
    totalTokens?: number,
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🤔️ I need some help to proceed*\n\n${waitingReason}`,
        },
      },
    ];

    this.renderFollowUpSuggestionsBlock(blocks, followUpSuggestions);

    this.renderTodoListBlock(blocks, todos);

    this.renderFooterBlock(blocks, taskId, messagesCount, totalTokens);

    return blocks;
  }

  renderTaskComplete(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    result: string,
    todos?: Todo[],
    messagesCount?: number,
    totalTokens?: number,
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
    ];

    this.renderTodoListBlock(blocks, todos);

    // Truncate result if too long to avoid Slack character limit
    const maxLength = 2900;
    let displayResult = result;

    if (result.length > maxLength) {
      displayResult = `${result.substring(0, maxLength)}...`;
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `✅ ${displayResult}`,
      },
    });

    this.renderFooterBlock(blocks, taskId, messagesCount, totalTokens);

    return blocks;
  }

  renderTaskFailed(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    errorMessage: string,
    todos?: Todo[],
    messagesCount?: number,
    totalTokens?: number,
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*❌ Something wrong happened, retrying ...*\n\n${errorMessage}`,
        },
      },
    ];

    this.renderTodoListBlock(blocks, todos);

    this.renderFooterBlock(blocks, taskId, messagesCount, totalTokens);

    return blocks;
  }

  private renderHeaderBlock(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
  ): AnyBlock {
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:books: <https://github.com/${githubRepository.owner}/${githubRepository.repo}|${githubRepository.owner}/${githubRepository.repo}> <@${slackUserId}>: ${prompt}`,
      },
    };
  }

  private renderFooterBlock(
    dst: AnyBlock[],
    taskId: string,
    messagesCount?: number,
    totalTokens?: number,
  ) {
    const statsTexts: string[] = [];

    if (messagesCount !== undefined && messagesCount > 0) {
      statsTexts.push(`📊 ${messagesCount} rounds`);
    }

    if (totalTokens !== undefined && totalTokens > 0) {
      const formattedTokens =
        totalTokens >= 1000
          ? `${(totalTokens / 1000).toFixed(1)}k`
          : totalTokens.toLocaleString();
      statsTexts.push(`🔢 ${formattedTokens} tokens`);
    }

    if (statsTexts.length > 0) {
      dst.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: statsTexts.join("  "),
          },
        ],
      });
    }

    dst.push({
      type: "actions",
      elements: [
        {
          type: "button" as const,
          text: {
            type: "plain_text" as const,
            text: "📄 See details",
          },
          url: `https://app.getpochi.com/tasks/${taskId}`,
          style: "primary" as const,
          action_id: "view_task_button",
        },
      ],
    });
  }

  private renderTodoListBlock(dst: AnyBlock[], todos?: Todo[]) {
    if (!todos || todos.length === 0) {
      return;
    }

    const isAllDone = todos.every(
      (todo) => todo.status === "completed" || todo.status === "cancelled",
    );

    let headerText = isAllDone ? "🎉 All done!" : "📝 Todo list";
    const inProgressTodo = todos.find((todo) => todo.status === "in-progress");
    if (inProgressTodo) {
      headerText = `📝 ${inProgressTodo.content}`;
    }

    const todoText = todos
      .filter(
        (todo) => todo.status !== "cancelled" && todo.status !== "in-progress",
      )
      .map((todo) => {
        if (todo.status === "completed") {
          return `• ~${todo.content}~`;
        }
        return `• ${todo.content}`;
      })
      .join("\n");

    dst.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${headerText}\n${todoText}`,
      },
    });
  }

  private renderFollowUpSuggestionsBlock(
    dst: AnyBlock[],
    suggestions?: string[],
  ) {
    if (!suggestions || suggestions.length === 0) {
      return;
    }

    const suggestionText = suggestions
      .map((suggestion, index) => `${index + 1}. ${suggestion}`)
      .join("\n");

    dst.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*💡 Suggested answers:*\n${suggestionText}`,
      },
    });
  }

  /**
   * Parse header to extract repository and user information
   */
  parseHeaderInfo(headerBlock: AnyBlock): {
    githubRepository?: { owner: string; repo: string };
    slackUserId?: string;
    prompt?: string;
  } {
    if (
      headerBlock.type !== "section" ||
      !("text" in headerBlock) ||
      !headerBlock.text ||
      headerBlock.text.type !== "mrkdwn" ||
      typeof headerBlock.text.text !== "string"
    ) {
      return {};
    }

    const text = headerBlock.text.text;

    // Extract slack user ID
    const userMatch = text.match(/<@([^>]+)>/);
    const slackUserId = userMatch?.[1];

    // Extract prompt
    const promptMatch = text.match(/about "([^"]+)"/);
    const prompt = promptMatch?.[1];

    // Looking for pattern like: |@owner/repo>
    const repoMatch = text.match(/\|@([^/]+)\/([^>]+)>/);
    const githubRepository = repoMatch
      ? {
          owner: repoMatch[1],
          repo: repoMatch[2],
        }
      : undefined;

    return {
      githubRepository,
      slackUserId,
      prompt,
    };
  }
}

export const slackRichTextRenderer = new SlackRichTextRenderer();
