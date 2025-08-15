import { promises as fs } from "node:fs";
import * as path from "node:path";
import { db } from "../src/db";
import { uidCoder } from "../src/db/id-coders";

interface MessagePart {
  type: string;
  text?: string;
}

interface ConversationMessage {
  role: string;
  parts: MessagePart[];
}

async function listProUsers() {
  const proUsers = await db
    .selectFrom("subscription")
    .where("status", "!=", "incomplete")
    .where("plan", "=", "pro")
    .select(["referenceId", "status", "periodStart", "periodEnd"])
    .execute();

  const orgSubscriptions = await db
    .selectFrom("subscription")
    .where("status", "!=", "incomplete")
    .where("plan", "=", "organization")
    .select(["referenceId", "status", "periodStart", "periodEnd"])
    .execute();

  const orgSubscriptionInfoMap = new Map(
    orgSubscriptions.map((s) => [
      s.referenceId,
      { status: s.status, periodStart: s.periodStart, periodEnd: s.periodEnd },
    ]),
  );
  const orgIds = orgSubscriptions.map((s) => s.referenceId);

  const orgMembers =
    orgIds.length === 0
      ? []
      : await db
          .selectFrom("member")
          .where("organizationId", "in", orgIds)
          .select(["userId", "organizationId"])
          .execute();

  const allUsers = [
    ...proUsers.map((u) => ({
      userId: u.referenceId,
      organizationId: null as string | null,
      status: u.status,
      periodStart: u.periodStart,
      periodEnd: u.periodEnd,
    })),
    ...orgMembers.map((m) => {
      const info = orgSubscriptionInfoMap.get(m.organizationId);
      return {
        userId: m.userId,
        organizationId: m.organizationId,
        status: info?.status ?? "unknown",
        periodStart: info?.periodStart ?? null,
        periodEnd: info?.periodEnd ?? null,
      };
    }),
  ];

  // Deduplicate, preferring the entry with an organizationId
  const userMap = new Map<
    string,
    {
      userId: string;
      organizationId: string | null;
      status: string;
      periodStart: Date | null;
      periodEnd: Date | null;
    }
  >();
  for (const user of allUsers) {
    const existing = userMap.get(user.userId);
    if (!existing || (user.organizationId && !existing.organizationId)) {
      userMap.set(user.userId, user);
    }
  }

  const uniqueUsers = Array.from(userMap.values());
  const userIds = uniqueUsers.map((u) => u.userId);

  if (userIds.length === 0) {
    return [];
  }

  const excludedEmails = [
    "fungjuelaing@gmail.com",
    "fungjueliang@gmail.com",
    "gyxlucy@gmail.com",
  ];

  const usersWithEmail = await db
    .selectFrom("user")
    .where("id", "in", userIds)
    .where("email", "not in", excludedEmails)
    .where("email", "not like", "%@tabbyml.com")
    .select(["id", "email"])
    .execute();

  const emailMap = new Map(usersWithEmail.map((u) => [u.id, u.email]));

  const result = [];
  for (const u of uniqueUsers) {
    const email = emailMap.get(u.userId);
    if (email) {
      result.push({
        ...u,
        email,
      });
    }
  }
  return result;
}

async function listTasks(users: Awaited<ReturnType<typeof listProUsers>>) {
  const userIds = users.map((u) => u.userId);
  const userEmailMap = new Map(users.map((u) => [u.userId, u.email as string]));

  if (userIds.length === 0) {
    return [];
  }

  const tasks = await db
    .selectFrom("task")
    .where("userId", "in", userIds)
    .select(["id", "userId", "createdAt", "title", "conversation"])
    .execute();

  const result = tasks.map((task) => {
    const conversation = task.conversation as {
      messagesNext?: ConversationMessage[];
    };
    const title =
      task.title ??
      conversation?.messagesNext?.[0]?.parts
        .find(
          (part) =>
            part.type === "text" &&
            typeof part.text === "string" &&
            !part.text.startsWith("<"),
        )
        ?.text?.split("\n")[0];

    return {
      taskId: task.id,
      userId: task.userId,
      userEmail: userEmailMap.get(task.userId),
      createdAt: task.createdAt,
      title: title,
      messagesNext: conversation?.messagesNext ?? null,
    };
  });

  return result;
}

async function generateUserStatistics(
  users: Awaited<ReturnType<typeof listProUsers>>,
  tasks: Awaited<ReturnType<typeof listTasks>>,
) {
  const userInfoMap = new Map(users.map((u) => [u.userId, u]));

  const statsByDay = new Map<
    string,
    { taskCount: number; conversationCount: number }
  >();

  for (const task of tasks) {
    if (!task.createdAt || !task.userId) continue;

    const date = new Date(task.createdAt).toISOString().split("T")[0];
    const key = `${task.userId}:${date}`;

    if (!statsByDay.has(key)) {
      statsByDay.set(key, { taskCount: 0, conversationCount: 0 });
    }

    const stats = statsByDay.get(key);
    if (!stats) {
      continue;
    }
    stats.taskCount += 1;

    if (task.messagesNext && Array.isArray(task.messagesNext)) {
      for (const message of task.messagesNext as ConversationMessage[]) {
        if (message.role === "user" && message.parts) {
          const hasValidText = message.parts.some(
            (part) =>
              part.type === "text" &&
              typeof part.text === "string" &&
              !part.text.startsWith("<"),
          );
          if (hasValidText) {
            stats.conversationCount += 1;
          }
        }
      }
    }
  }

  const dataForCsv = [];
  for (const [key, stats] of statsByDay.entries()) {
    const [userId, date] = key.split(":");
    const userInfo = userInfoMap.get(userId);

    if (userInfo) {
      dataForCsv.push({
        email: userInfo.email,
        status: userInfo.status,
        periodStart: userInfo.periodStart,
        periodEnd: userInfo.periodEnd,
        date,
        ...stats,
      });
    }
  }

  dataForCsv.sort((a, b) => {
    if (a.email && b.email && a.email !== b.email) {
      return a.email.localeCompare(b.email);
    }
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const csvRows = [
    [
      "User Email",
      "Subscription Status",
      "Subscription Start",
      "Subscription End",
      "Date",
      "Task Count",
      "Conversation Count",
    ].join(","),
  ];

  for (const item of dataForCsv) {
    csvRows.push(
      [
        item.email,
        item.status,
        item.periodStart ? new Date(item.periodStart).toISOString() : "N/A",
        item.periodEnd ? new Date(item.periodEnd).toISOString() : "N/A",
        item.date,
        item.taskCount,
        item.conversationCount,
      ]
        .map((value) => value ?? "")
        .join(","),
    );
  }

  return csvRows.join("\n");
}

function countValidConversations(
  messages: ConversationMessage[] | null,
): number {
  if (!messages || !Array.isArray(messages)) {
    return 0;
  }
  let count = 0;
  for (const message of messages) {
    if (message.role === "user" && message.parts) {
      const hasValidText = message.parts.some(
        (part) =>
          part.type === "text" &&
          typeof part.text === "string" &&
          !part.text.startsWith("<"),
      );
      if (hasValidText) {
        count++;
      }
    }
  }
  return count;
}

async function generateTaskStatisticsByUser(
  users: Awaited<ReturnType<typeof listProUsers>>,
  tasks: Awaited<ReturnType<typeof listTasks>>,
): Promise<Map<string, string>> {
  const userReports = new Map<string, string>();

  const tasksByUser = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.userId) continue;
    if (!tasksByUser.has(task.userId)) {
      tasksByUser.set(task.userId, []);
    }
    tasksByUser.get(task.userId)?.push(task);
  }

  for (const user of users) {
    if (!user.email) continue;

    const userTasks = tasksByUser.get(user.userId) ?? [];
    if (userTasks.length === 0) continue;

    // Sort tasks by creation time
    userTasks.sort(
      (a, b) =>
        (a.createdAt ? new Date(a.createdAt).getTime() : 0) -
        (b.createdAt ? new Date(b.createdAt).getTime() : 0),
    );

    const filename = `${user.email.replace(/@/g, "_")}.csv`;

    const csvRows = [
      [
        "task id",
        "user email",
        "task create time",
        "title",
        "conversation count",
        "link",
        "status",
      ].join(","),
    ];

    for (const task of userTasks) {
      if (!task.createdAt) continue;
      const createdAt = new Date(task.createdAt);
      const isActive =
        user.periodStart &&
        user.periodEnd &&
        createdAt >= new Date(user.periodStart) &&
        createdAt <= new Date(user.periodEnd);
      const status = isActive ? "active" : "";

      const conversationCount = countValidConversations(
        task.messagesNext as ConversationMessage[] | null,
      );
      const link = `https://app.getpochi.com/share/${uidCoder.encode(
        task.taskId,
      )}`;

      csvRows.push(
        [
          task.taskId,
          user.email,
          task.createdAt ? new Date(task.createdAt).toISOString() : "N/A",
          task.title ?? "",
          conversationCount,
          link,
          status,
        ]
          .map((value) => value ?? "")
          .join(","),
      );
    }
    userReports.set(filename, csvRows.join("\n"));
  }
  return userReports;
}

async function main() {
  const outputDir = path.join(__dirname, "output");
  await fs.mkdir(outputDir, { recursive: true });

  const users = await listProUsers();
  const tasks = await listTasks(users);

  // Generate general statistics
  const statisticsCsv = await generateUserStatistics(users, tasks);
  const generalOutputPath = path.join(outputDir, "user-statistics.csv");
  await fs.writeFile(generalOutputPath, statisticsCsv);
  console.log(`User statistics saved to ${generalOutputPath}`);

  // Generate task statistics by user
  const userReports = await generateTaskStatisticsByUser(users, tasks);
  for (const [filename, content] of userReports.entries()) {
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, content);
    console.log(`Generated report for ${filename} at ${outputPath}`);
  }

  console.log("All reports have been generated.");

  await db.destroy();
}

main();
