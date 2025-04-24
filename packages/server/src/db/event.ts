import type { KnownEventFromType } from "@slack/bolt";

export type UserEvent =
  | {
      type: "slack:message";
      data: KnownEventFromType<"message">;
    }
  | {
      type: string;
      data: unknown;
    };
