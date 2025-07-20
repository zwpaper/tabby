import { trace } from "@opentelemetry/api";
import type { LanguageModelV1Prompt } from "ai";

type RagdollAttributes = {
  "ragdoll.user.email": string;
  "ragdoll.metering.credit": number;
  "ai.prompt.rawMessages": LanguageModelV1Prompt;
};

class RagdollTrace {
  setAttribute<K extends keyof RagdollAttributes>(
    key: K,
    value: RagdollAttributes[K],
  ) {
    const span = trace.getActiveSpan();
    if (!span) return;

    if (isPOD(value)) {
      span.setAttribute(key, value);
    } else {
      span.setAttribute(key, JSON.stringify(value));
    }
  }
}

function isPOD(value: unknown) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export const tracer = new RagdollTrace();
