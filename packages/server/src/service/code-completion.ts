import { HTTPException } from "hono/http-exception";
import type { CodeCompletionRequest, CodeCompletionResponse } from "../types";

export class CodeCompletionService {
  // FIM (Fill-in-Middle) prompt building for Mistral API
  private buildFIMPrompt(req: CodeCompletionRequest): {
    prompt: string;
    suffix?: string;
  } {
    const { segments, language } = req;
    let enhancedPrefix = this.buildPrefixWithContext(segments, language);
    enhancedPrefix += segments.prefix;
    return {
      prompt: enhancedPrefix,
      suffix: segments.suffix,
    };
  }

  // Build prefix with context snippets (following Tabby's pattern)
  private buildPrefixWithContext(
    segments: CodeCompletionRequest["segments"],
    language?: string,
  ): string {
    const snippets: Array<{ filepath: string; body: string }> = [];

    // Collect all context snippets in priority order
    if (segments.declarations) {
      snippets.push(...segments.declarations.slice(0, 5)); // Top 5 declarations
    }

    if (segments.relevantSnippetsFromChangedFiles) {
      snippets.push(...segments.relevantSnippetsFromChangedFiles.slice(0, 3));
    }

    if (segments.relevantSnippetsFromRecentlyOpenedFiles) {
      snippets.push(
        ...segments.relevantSnippetsFromRecentlyOpenedFiles.slice(0, 2),
      ); // Top 2 recent files
    }

    if (snippets.length === 0) {
      return "";
    }

    // Get comment character for the language
    const commentChar = this.getLanguageCommentChar(language);

    const lines: string[] = [];

    for (let i = 0; i < snippets.length; i++) {
      const snippet = snippets[i];
      lines.push(`Path: ${snippet.filepath}`);

      // Add snippet body lines
      for (const line of snippet.body.split("\n")) {
        lines.push(line);
      }

      // Add empty line between snippets (except the last one)
      if (i < snippets.length - 1) {
        lines.push("");
      }
    }

    // Comment all lines
    const commentedLines = lines.map((line) => {
      if (line === "") {
        return commentChar;
      }
      return `${commentChar} ${line}`;
    });

    return `${commentedLines.join("\n")}\n`;
  }

  // Get language-specific comment character
  private getLanguageCommentChar(language?: string): string {
    switch (language?.toLowerCase()) {
      case "python":
      case "bash":
      case "shell":
      case "yaml":
      case "toml":
        return "#";
      case "javascript":
      case "typescript":
      case "java":
      case "c":
      case "cpp":
      case "csharp":
      case "go":
      case "rust":
      case "kotlin":
      case "swift":
      case "dart":
        return "//";
      case "html":
      case "xml":
        return "<!--";
      case "css":
      case "scss":
      case "less":
        return "/*";
      case "sql":
        return "--";
      case "lua":
        return "--";
      case "haskell":
        return "--";
      case "erlang":
        return "%";
      default:
        return "//"; // Default to // for unknown languages
    }
  }

  // Mistral FIM completion service call
  private async callMistralFIMCompletion(options: {
    prompt: string;
    suffix?: string;
    temperature: number;
    maxTokens: number;
    signal?: AbortSignal;
  }): Promise<string> {
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    const mistralEndpoint =
      process.env.MISTRAL_API_ENDPOINT || "https://api.mistral.ai";

    if (!mistralApiKey) {
      throw new Error("MISTRAL_API_KEY environment variable is required");
    }

    const requestBody = {
      prompt: options.prompt,
      suffix: options.suffix || null,
      model: process.env.MISTRAL_MODEL || "codestral-latest",
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: false,
      random_seed: Math.floor(Math.random() * 1000000),
      stop: ["\n\n", "\r\n\r\n"],
    };

    const response = await fetch(`${mistralEndpoint}/v1/fim/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Mistral API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = (await response.json()) as {
      choices: Array<{
        message?: { content: string };
        text?: string;
        delta?: { content: string };
      }>;
    };

    // Extract completion text from Mistral FIM response format
    const choice = result.choices?.[0];
    if (!choice) {
      throw new Error("No completion choices returned from Mistral API");
    }

    return (
      choice.message?.content || choice.text || choice.delta?.content || ""
    );
  }

  // Main completion method
  async generateCompletion(
    req: CodeCompletionRequest,
    signal?: AbortSignal,
  ): Promise<CodeCompletionResponse> {
    // Build FIM prompt from segments
    const { prompt, suffix } = this.buildFIMPrompt(req);

    if (prompt.length > 32000) {
      throw new HTTPException(400, {
        message:
          "Request context is too large. Please reduce the amount of context provided.",
      });
    }

    // Call Mistral FIM completion service
    const completionText = await this.callMistralFIMCompletion({
      prompt,
      suffix,
      temperature: req.temperature ?? 0.1,
      maxTokens: 256,
      signal,
    });

    // Generate unique completion ID
    const completionId = `cmpl-${crypto.randomUUID()}`;

    return {
      id: completionId,
      choices: [
        {
          index: 0,
          text: completionText,
        },
      ],
    };
  }
}

export const codeCompletionService = new CodeCompletionService();
