import type { Environment } from "@/types";

export function getEnvironmentPrompt(environment:  Environment) {
    const sections = [
        getCurrentTimePrompt(environment.currentTime),
    ].filter(Boolean).join("\n\n");
    return `<environment_details>
${sections}
</environment_details>`
}

function getCurrentTimePrompt(currentTime: string | undefined) {
    if (currentTime) {
        return `# Current Time\n${currentTime}`
    } else {
        return ""
    }
}