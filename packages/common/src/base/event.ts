export type WebsiteTaskCreateEvent = {
  type: "website:new-project";
  data: {
    requestId: string;
    name?: string;
    prompt: string;
    attachments?: {
      url: string;
      name?: string;
      contentType?: string;
    }[];
    githubTemplateUrl?: string;
  };
};
