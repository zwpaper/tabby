import { type Span, trace } from "@opentelemetry/api";
import type { LanguageModelV1Prompt } from "ai";

type RagdollAttributes = {
  "ragdoll.user.email": string;
  "ragdoll.task.uid": string;
  "ragdoll.metering.credit": number;
  "ragdoll.minion.sandboxId": string;
  "ai.prompt.rawMessages": LanguageModelV1Prompt;
};

class SpanConfigurator {
  setAttribute<K extends keyof RagdollAttributes>(
    key: K,
    value: RagdollAttributes[K],
    span?: Span,
  ) {
    const targetSpan = span || trace.getActiveSpan();
    if (!targetSpan) return;

    if (isPOD(value)) {
      targetSpan.setAttribute(key, value);
    } else {
      targetSpan.setAttribute(key, JSON.stringify(value));
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

export const spanConfig = new SpanConfigurator();
