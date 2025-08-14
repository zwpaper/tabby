import { type Span, trace } from "@opentelemetry/api";

type RagdollAttributes = {
  "ragdoll.user.email": string;
  "ragdoll.task.uid": string;
  "ragdoll.metering.credit": number;
  "ragdoll.minion.sandboxId": string;
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
