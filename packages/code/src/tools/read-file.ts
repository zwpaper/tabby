import fs from "fs/promises";

export async function readFile({
    path,
    startLine,
    endLine
}: {
    path: string;
    startLine?: number;
    endLine?: number;
}): Promise<{ content: string }> {
    const fileContent = await fs.readFile(path, "utf-8");
    const lines = fileContent.split("\n");

    const start = startLine ? startLine - 1 : 0;
    const end = endLine ? endLine : lines.length;

    const selectedLines = lines.slice(start, end).join("\n");

    return { content: selectedLines };
}