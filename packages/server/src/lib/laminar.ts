import { Laminar } from "@lmnr-ai/lmnr";

if (process.env.LMNR_PROJECT_API_KEY) {
  Laminar.initialize({
    projectApiKey: process.env.LMNR_PROJECT_API_KEY,
  });
}
