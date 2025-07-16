import { prompts } from "@ragdoll/common";
import type { DBMessage, Todo } from "@ragdoll/db";
import type { AnyBlock } from "@slack/web-api";
import slackifyMarkdown from "slackify-markdown";

export interface TaskRenderContext {
  headerInfo: {
    prompt: string;
    githubRepository: { owner: string; repo: string };
    slackUserId: string;
  };
  task: {
    uid: string;
    todos?: Todo[];
    conversation?: { messages: DBMessage[] } | null | undefined;
  };
  stats?: {
    requestsCount?: number;
    totalTokens?: number;
  };
}

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
    requestsCount?: number,
    totalTokens?: number,
    conversation?: { messages: DBMessage[] } | null | undefined,
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      ...this.renderTaskHistoryBlock(conversation, false, slackUserId),
      PreparingTaskBlock,
    ];

    this.renderTodoListBlock(blocks, todos);

    this.renderFooterBlock(blocks, taskId, requestsCount, totalTokens);

    return blocks;
  }

  renderTaskRunning(context: TaskRenderContext): AnyBlock[] {
    const { headerInfo, task, stats } = context;
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(
        headerInfo.prompt,
        headerInfo.githubRepository,
        headerInfo.slackUserId,
      ),
      ...this.renderTaskHistoryBlock(
        task.conversation,
        true,
        headerInfo.slackUserId,
      ),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🟢 Running*",
        },
      },
    ];

    this.renderTodoListBlock(blocks, task.todos);

    this.renderFooterBlock(
      blocks,
      task.uid,
      stats?.requestsCount,
      stats?.totalTokens,
    );

    return blocks;
  }

  renderTaskAskFollowUpQuestion(
    context: TaskRenderContext,
    waitingReason: string,
    followUpSuggestions?: string[],
  ): AnyBlock[] {
    const { headerInfo, task, stats } = context;
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(
        headerInfo.prompt,
        headerInfo.githubRepository,
        headerInfo.slackUserId,
      ),
      ...this.renderTaskHistoryBlock(
        task.conversation,
        false,
        headerInfo.slackUserId,
      ),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🤔 I need some help to proceed*\n\n${slackifyMarkdown(waitingReason)}`,
        },
      },
    ];

    this.renderFollowUpSuggestionsBlock(blocks, followUpSuggestions, task.uid);

    this.renderTodoListBlock(blocks, task.todos);

    this.renderFooterBlock(
      blocks,
      task.uid,
      stats?.requestsCount,
      stats?.totalTokens,
    );

    return blocks;
  }

  renderTaskComplete(context: TaskRenderContext, result: string): AnyBlock[] {
    const { headerInfo, task, stats } = context;
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(
        headerInfo.prompt,
        headerInfo.githubRepository,
        headerInfo.slackUserId,
      ),
      ...this.renderTaskHistoryBlock(
        task.conversation,
        false,
        headerInfo.slackUserId,
      ),
    ];

    this.renderTodoListBlock(blocks, task.todos);

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
        text: `✅ ${slackifyMarkdown(displayResult)}`,
      },
    });

    this.renderFooterBlock(
      blocks,
      task.uid,
      stats?.requestsCount,
      stats?.totalTokens,
      true,
    );

    return blocks;
  }

  renderTaskFailed(
    context: TaskRenderContext,
    errorMessage: string,
  ): AnyBlock[] {
    const { headerInfo, task, stats } = context;
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(
        headerInfo.prompt,
        headerInfo.githubRepository,
        headerInfo.slackUserId,
      ),
      ...this.renderTaskHistoryBlock(
        task.conversation,
        false,
        headerInfo.slackUserId,
      ),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*❌ Something wrong happened, retrying ...*\n\n${errorMessage}`,
        },
      },
    ];

    this.renderTodoListBlock(blocks, task.todos);

    this.renderFooterBlock(
      blocks,
      task.uid,
      stats?.requestsCount,
      stats?.totalTokens,
    );

    return blocks;
  }

  renderWaitlistApprovalRequired(userEmail?: string): AnyBlock[] {
    const blocks: AnyBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🐈 Reservation now!",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Oops! You need to be a Pochi member to use this command.*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "I can see you're trying to get some AI teammate help – that's exactly what I do! 🐱\n\n*Here's what you're missing out on:*\n• AI writes code for you based on simple descriptions\n• Automatic bug fixes and feature implementations  \n• Seamless GitHub integration\n• Real-time progress updates (just like you tried to use!)",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "⚡ *Quick start:* Sign up takes less than 2 minutes, then come back and try that command again!",
        },
      },
    ];

    // Add email information if provided
    if (userEmail) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📧 Use \`${userEmail}\` to sign up and get started.`,
        },
      });
    }

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🚀 Get Started Now",
            emoji: true,
          },
          style: "primary",
          url: "https://app.getpochi.com",
          action_id: "get_started_button",
        },
      ],
    });

    return blocks;
  }

  renderGitHubConnectionRequired(userEmail?: string): AnyBlock[] {
    const blocks: AnyBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🔗 GitHub Not Connected",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🔗 *Almost there!*\n\nYou're a Pochi member, but we need access to your GitHub repositories to help you code.",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🛡️ *Why connect GitHub?*\n• Pochi reads your code to understand context\n• Makes intelligent suggestions based on your codebase\n• Can directly create pull requests with fixes\n• Keeps your code secure with read-only access by default",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "⚡ *Takes 30 seconds:* Connect GitHub, then come back and try your command again!",
        },
      },
    ];

    // Add email information naturally if provided
    if (userEmail) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `💡 *Having trouble connecting?* You're currently signed in with \`${userEmail}\`. Make sure this email matches the one you use in GitHub, as email mismatches are a common cause of connection issues.`,
        },
      });
    }

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔗 Connect GitHub",
            emoji: true,
          },
          style: "primary",
          url: "https://app.getpochi.com/integrations",
          action_id: "connect_github_button",
        },
      ],
    });

    return blocks;
  }

  renderCreditLimitReached(): AnyBlock[] {
    const blocks: AnyBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "💳 Credit Limit Reached",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*You've reached your credit limit for this billing period.*",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Thanks for using Pochi! 🚀 You've been actively coding with AI assistance.\n\n*What you can do:*\n• Add a Credit Card in your account settings for unlimited usage\n• Wait for your credits to reset next billing cycle\n• Check your usage and billing details in your account\n• Contact support if you have questions",
        },
      },
    ];

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
    requestsCount?: number,
    totalTokens?: number,
    showReplyButton?: boolean,
  ) {
    const statsTexts: string[] = [];

    if (requestsCount !== undefined && requestsCount > 0) {
      statsTexts.push(`📊 ${requestsCount} rounds`);
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

    const actionElements = [];

    // Add reply button if requested
    if (showReplyButton) {
      actionElements.push({
        type: "button" as const,
        text: {
          type: "plain_text" as const,
          text: "💬 Reply",
        },
        action_id: `followup_${taskId}_custom`,
        style: "primary" as const,
      });
    }

    // Always add see details button
    actionElements.push({
      type: "button" as const,
      text: {
        type: "plain_text" as const,
        text: "📄 See details",
      },
      url: `https://app.getpochi.com/tasks/${taskId}`,
      style: "primary" as const,
      action_id: "view_task_button",
    });

    dst.push({
      type: "actions",
      elements: actionElements,
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
    taskId?: string,
  ) {
    // If no taskId, we can't create action buttons
    if (!taskId) {
      return;
    }

    // Add suggestion text block only if there are suggestions
    if (suggestions && suggestions.length > 0) {
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

    // Always add action buttons (suggestions + reply button)
    const elements: {
      type: "button";
      text: { type: "plain_text"; text: string };
      action_id: string;
      style?: "primary";
    }[] = [];

    // Add suggestion buttons if there are suggestions
    if (suggestions && suggestions.length > 0) {
      const suggestionButtons = suggestions.map((suggestion, index) => {
        // Encode suggestion content in base64 to avoid special characters in action_id
        const encodedSuggestion = Buffer.from(suggestion).toString("base64");
        return {
          type: "button" as const,
          text: {
            type: "plain_text" as const,
            text: `${index + 1}`,
          },
          action_id: `followup_${taskId}_direct_${encodedSuggestion}`,
          style: "primary" as const,
        };
      });
      elements.push(...suggestionButtons);
    }

    // Always add the custom reply button
    const customButton = {
      type: "button" as const,
      text: {
        type: "plain_text" as const,
        text: "Reply",
      },
      action_id: `followup_${taskId}_custom`,
    };
    elements.push(customButton);

    // Add the actions block with all buttons
    dst.push({
      type: "actions",
      elements,
    });
  }

  renderUserAnswerBlock(answer: string): AnyBlock {
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `👤 *You replied:* ${answer}`,
      },
    };
  }

  updateMessageWithUserAnswer(blocks: AnyBlock[], answer: string): AnyBlock[] {
    const updatedBlocks = [...blocks];
    const userAnswerBlock = this.renderUserAnswerBlock(answer);

    // Find the last actions block and insert the answer before it
    const actionsIndices = updatedBlocks
      .map((block, index) => (block.type === "actions" ? index : -1))
      .filter((index) => index !== -1);

    if (actionsIndices.length > 0) {
      const lastActionsIndex = actionsIndices[actionsIndices.length - 1];
      updatedBlocks.splice(lastActionsIndex, 0, userAnswerBlock);
    } else {
      // If no actions block found, just append
      updatedBlocks.push(userAnswerBlock);
    }

    return updatedBlocks;
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

  /**
   * Render task history from conversation messages
   */
  renderTaskHistoryBlock(
    conversation: { messages: DBMessage[] } | null | undefined,
    includeLatestMessage = false,
    slackUserId?: string,
  ): AnyBlock[] {
    if (!conversation?.messages || conversation.messages.length === 0) {
      return [];
    }

    const historyItems: string[] = [];
    const maxChars = 37000; // Reserve 3000 chars for other content in Slack message
    let currentLength = 0;

    const allMessages = [...conversation.messages].reverse(); // newest first
    const firstUserMessageIndex = conversation.messages.findIndex(
      (msg) => msg.role === "user",
    );

    const messagesToProcess = includeLatestMessage
      ? allMessages
      : allMessages.slice(1); // skip latest

    const messages = messagesToProcess.filter((msg, index) => {
      const originalIndex =
        conversation.messages.length -
        1 -
        (includeLatestMessage ? index : index + 1);
      return !(msg.role === "user" && originalIndex === firstUserMessageIndex);
    });

    for (const message of messages) {
      if (currentLength >= maxChars) break;

      if (message.role === "user") {
        const textParts =
          message.parts?.filter((part) => part.type === "text") || [];
        const validTextParts: string[] = [];
        for (const part of textParts) {
          const text = part.text;
          if (!text) continue;
          if (prompts.isSystemReminder(text)) continue;
          validTextParts.push(text);
        }
        const userText = validTextParts.join(" ").trim();
        if (userText && userText.length > 0) {
          const userPrefix = slackUserId ? `<@${slackUserId}>` : "👤 *User:*";
          const historyItem = `${userPrefix}: ${slackifyMarkdown(userText)}`;
          if (currentLength + historyItem.length > maxChars) break;
          historyItems.push(historyItem);
          currentLength += historyItem.length;
        }
      } else if (message.role === "assistant") {
        // Check for completion attempts first
        const completionPart = message.parts?.find(
          (part) =>
            part.type === "tool-invocation" &&
            part.toolInvocation?.toolName === "attemptCompletion" &&
            part.toolInvocation?.args?.result,
        );

        if (
          completionPart?.type === "tool-invocation" &&
          completionPart?.toolInvocation?.args?.result
        ) {
          const result = completionPart.toolInvocation.args.result as string;
          const historyItem = `✅ *Completed:* ${slackifyMarkdown(result)}`;

          // Check if this item would exceed our limit
          if (currentLength + historyItem.length > maxChars) break;

          historyItems.push(historyItem);
          currentLength += historyItem.length;
        }

        // Check for follow-up questions
        const askFollowUpPart = message.parts?.find(
          (part) =>
            part.type === "tool-invocation" &&
            part.toolInvocation?.toolName === "askFollowupQuestion" &&
            part.toolInvocation?.args?.question,
        );

        if (
          askFollowUpPart?.type === "tool-invocation" &&
          askFollowUpPart?.toolInvocation?.args?.question
        ) {
          const question = askFollowUpPart.toolInvocation.args
            .question as string;
          const historyItem = `*🤔 I need some help to proceed*\n${slackifyMarkdown(question)}`;

          // Check if this item would exceed our limit
          if (currentLength + historyItem.length > maxChars) break;

          historyItems.push(historyItem);
          currentLength += historyItem.length;
        }
      }
    }

    if (historyItems.length === 0) {
      return [];
    }

    const orderedItems = historyItems.reverse();

    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: orderedItems.join("\n"),
        },
      },
    ];
  }
}

export const slackRichTextRenderer = new SlackRichTextRenderer();
