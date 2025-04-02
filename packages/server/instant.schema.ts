import { i } from "@instantdb/core";

const schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),
    chatCompletions: i.entity({
      timestamp: i.date().indexed(),
      promptTokens: i.number(),
      completionTokens: i.number(),
    }),
  },
  links: {
    chatCompletionsUser: {
      forward: { on: "chatCompletions", has: "one", label: "user" },
      reverse: { on: "$users", has: "many", label: "chatCompletions" },
    },
  },
});

export default schema;
