import { ToolCall } from "ai";
import { listFiles } from "./list-files";
import { readFile } from "./read-file";

async function onToolCallImpl(tool: { toolCall: ToolCall<string, unknown>}) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (tool.toolCall.toolName === "listFiles") {
        return listFiles(tool.toolCall.args as any);
    } else if (tool.toolCall.toolName === "readFile") {
        return readFile(tool.toolCall.args as any);
    } else {
        throw new Error(`${tool.toolCall.toolName} is not implemented`)
    }
}

function safeCall<T>(x: Promise<T>) {
    return x.catch((e) => {
        return {
            error: e.message
        }
    });
}

export async function onToolCall(tool: { toolCall: ToolCall<string, unknown>}) {
    return await safeCall(onToolCallImpl(tool));
}