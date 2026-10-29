import { defineHandler } from "void";
import { env } from "void/env";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { meilisearchSearch } from "@meilisearch/ai-sdk";
import { Meilisearch } from "meilisearch";
import { z } from "zod";
import { HIDDEN_LAYOUTS } from "@/lib/search";

const RULES_INDEX = "mtg_rules";
const GLOSSARY_INDEX = "mtg_glossary";
const CARDS_INDEX = "scryfall_cards";
// Both indexes were configured with a Gemini embedder under this name.
const EMBEDDER = "gemini";
const MAX_STEPS = 8;

const SYSTEM_PROMPT = `You are a Magic: The Gathering rules assistant.
Answer only from what the tools return: look up terms in the glossary, search the Comprehensive Rules, use getRule to read a rule and its sub-rules in full, and use searchCards to read the exact text of any card the question mentions. Search again with different words if a result is thin; stop when the evidence is sufficient.
Cite rule numbers (e.g. 704.5a) for every claim. If the tools return nothing relevant, say so instead of guessing.
Write plain text, no markdown.`;

const RULE_ATTRIBUTES = ["rule_id", "rule_text", "rule_path"];
const CARD_ATTRIBUTES = [
  "oracle_id",
  "name",
  "mana_cost",
  "type_line",
  "oracle_text",
  "keywords",
  "card_faces",
  "image_uris",
];
const RULE_ID = /^\d{3}(\.\d+[a-z]?)?$/;

export const POST = defineHandler(async (c) => {
  const { messages } = (await c.req.json()) as { messages: UIMessage[] };

  const host = env.MEILISEARCH_URL;
  const apiKey = env.MEILISEARCH_KEY;
  const client = new Meilisearch({ host, apiKey });
  const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

  const result = streamText({
    model: openrouter.chat(env.OPENROUTER_MODEL),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(MAX_STEPS),
    tools: {
      searchGlossary: meilisearchSearch({
        host,
        apiKey,
        indexUid: GLOSSARY_INDEX,
        description:
          "Look up official MTG glossary definitions for keywords, actions, and mechanics (e.g. 'Deathtouch', 'Trample', 'Priority').",
        searchParams: {
          limit: 5,
          attributesToRetrieve: ["term", "definition"],
          hybrid: { embedder: EMBEDDER, semanticRatio: 0.5 },
        },
      }),
      searchRules: meilisearchSearch({
        host,
        apiKey,
        indexUid: RULES_INDEX,
        description:
          "Search the MTG Comprehensive Rules by rule number or topic (e.g. 'Rule 704 State-Based Actions', 'Combat Phase sequence').",
        searchParams: {
          limit: 10,
          attributesToRetrieve: RULE_ATTRIBUTES,
          hybrid: { embedder: EMBEDDER, semanticRatio: 0.5 },
        },
      }),
      searchCards: meilisearchSearch({
        host,
        apiKey,
        indexUid: CARDS_INDEX,
        description:
          "Find Magic cards by name or by what they do (e.g. 'Lightning Bolt', 'creature with deathtouch and trample') and read their exact oracle text.",
        searchParams: {
          limit: 5,
          distinct: "oracle_id",
          filter: `layout NOT IN [${HIDDEN_LAYOUTS.join(", ")}]`,
          attributesToRetrieve: CARD_ATTRIBUTES,
          hybrid: { embedder: EMBEDDER, semanticRatio: 0.5 },
        },
      }),
      getRule: tool({
        description:
          "Read one rule of the MTG Comprehensive Rules in full, with all of its sub-rules, by rule number (e.g. '104', '104.3', '704.5a').",
        inputSchema: z.object({
          ruleId: z.string().regex(RULE_ID).describe("Rule number such as 104, 104.3 or 704.5a"),
        }),
        execute: async ({ ruleId }) => {
          const { hits } = await client.index(RULES_INDEX).search("", {
            filter: `rule_id = "${ruleId}" OR ancestor_ids = "${ruleId}"`,
            sort: ["rule_id:asc"],
            limit: 100,
            attributesToRetrieve: RULE_ATTRIBUTES,
          });
          return { ruleId, hits };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
});
