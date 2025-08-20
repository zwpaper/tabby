import { z } from "zod";

export const WebsiteTaskCreateEvent = z.object({
  type: z.literal("website:new-project"),
  data: z.object({
    uid: z.string(),
    name: z.string().optional(),
    prompt: z.string(),
    attachments: z
      .array(
        z.object({
          url: z.string(),
          name: z.string().optional(),
          contentType: z.string().optional(),
        }),
      )
      .optional(),
    githubTemplateUrl: z.string().optional(),
  }),
});

export type WebsiteTaskCreateEvent = z.infer<typeof WebsiteTaskCreateEvent>;

export const WebsiteTaskOpenEvent = z.object({
  type: z.literal("website:open-task"),
  data: z.object({
    uid: z.string(),
  }),
});

export type WebsiteTaskOpenEvent = z.infer<typeof WebsiteTaskOpenEvent>;
