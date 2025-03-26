import type { Environment } from "@/types";

export function getEnvironmentPrompt(environment: Environment) {
    const sections = [
        getCurrentTimePrompt(environment.currentTime),
        getWorkspaceFilesPrompt(environment.workspace),
    ].filter(Boolean).join("\n\n");
    return `<environment_details>
${sections}
</environment_details>`;
}

function getCurrentTimePrompt(currentTime: string | undefined) {
    if (currentTime) {
        return `# Current Time\n${currentTime}`;
    } else {
        return "";
    }
}

function getWorkspaceFilesPrompt(workspace: Environment["workspace"]) {
    if (workspace) {
        const { files, isTruncated } = workspace;
        const filesList = files.join("\n");
        const truncatedMessage = isTruncated ? "\n(Note: The list of files is truncated. Use listFiles tool to explore if needed)" : "";
        return `# Current Working Directory (${workspace.cwd}) Files\n${filesList}${truncatedMessage}`;
    } else {
        return "";
    }
}