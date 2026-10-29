import { defineEnv, string, url } from "void/env";

export default defineEnv({
  MEILISEARCH_URL: url(),
  MEILISEARCH_KEY: string(),
  OPENROUTER_API_KEY: string(),
  OPENROUTER_MODEL: string().default("openai/gpt-4.1-mini"),
});
