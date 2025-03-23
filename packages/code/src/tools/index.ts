import { ToolCall } from "ai";
import { listFiles } from "./list-files";
import { readFile } from "./read-file";

export async function onToolCall(tool: { toolCall: ToolCall<string, unknown> }) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (tool.toolCall.toolName === "listFiles") {
        return listFiles(tool.toolCall.args as any);
    } else if (tool.toolCall.toolName === "readFile") {
        return readFile(tool.toolCall.args as any);
    } else {
        return {
            error: `${tool.toolCall.toolName} is not implemented`
        }
    }
}