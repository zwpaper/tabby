import type { InstantRules } from "@instantdb/core";

const rules = {
  attrs: {
    allow: {
      $default: "false",
    },
  },
  chatCompletions: {
    allow: {
      view: "isOwner",
      $default: "false",
    },
    bind: ["isOwner", "auth.id != null && auth.id == data.user.id"],
  },
} satisfies InstantRules;

export default rules;
