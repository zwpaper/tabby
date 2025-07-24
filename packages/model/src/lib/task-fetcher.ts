import type { TaskData } from "../types";

const QuickWitBaseUrl = "https://quickwit.jump.getpochi.com/";

function assistantToolCallToText({
  toolName,
  args,
}: {
  toolName: string;
  args: unknown;
}) {
  return `<api-request name="${toolName}">${JSON.stringify(
    args,
  )}</api-request>`;
}

export async function fetchTask(uid: string, auth: string): Promise<TaskData> {
  const urlBuilder = new URL(QuickWitBaseUrl);
  urlBuilder.pathname = "/api/v1/otel-traces-v0_7/search";
  urlBuilder.searchParams.append(
    "query",
    `span_name:"ai.streamText.doStream" AND span_attributes.ai.telemetry.metadata.task-id:"${uid}"`,
  );
  urlBuilder.searchParams.append("sort_by", "span_start_timestamp_nanos");
  urlBuilder.searchParams.append("max_hits", "1");
  urlBuilder.searchParams.append("format", "json");

  const response = await fetch(urlBuilder.toString(), {
    headers: {
      Authorization: auth,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch task: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  if (data.hits.length === 0) {
    throw new Error(`No task found for uid: ${uid}`);
  }
  const hit = data.hits[0];
  const prompt = hit.span_attributes["ai.prompt.rawMessages"];
  console.log(prompt);

  const taskData: TaskData = {
    uid,
    messages: JSON.parse(prompt),
  };

  const responseMessage: TaskData["messages"][number] = {
    role: "assistant",
    content: [],
  };
  const responseText = hit.span_attributes["ai.response.text"];
  if (responseText) {
    responseMessage.content.push({
      type: "text",
      text: responseText,
    });
  }

  const responseToolCalls = hit.span_attributes["ai.response.toolCalls"];
  const toolCalls = JSON.parse(responseToolCalls);
  if (toolCalls && Array.isArray(toolCalls)) {
    for (const toolCall of toolCalls) {
      responseMessage.content.push({
        type: "text",
        text: assistantToolCallToText(toolCall),
      });
    }
  }

  if (responseMessage.content.length > 0) {
    taskData.messages.push(responseMessage);
  }

  return taskData;
}
