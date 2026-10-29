import { defineHandler, defineHead, type InferProps } from "void";
import { db, sql } from "void/db";

export type Props = InferProps<typeof loader>;

export type CardResult = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  imageUrl: string | null;
};

const RESULT_LIMIT = 50;
// Scryfall layouts that are not playable cards (art cards, tokens, emblems).
const HIDDEN_LAYOUTS = ["art_series", "token", "double_faced_token", "emblem"];

// Turns free text into an FTS5 prefix query: `ligh bol` -> `"ligh"* "bol"*`.
// Each word is quoted so FTS5 operators and punctuation in the input are
// treated literally.
function toFtsQuery(input: string): string | null {
  const terms = input
    .split(/\s+/)
    .map((term) => term.replace(/"/g, "").trim())
    .filter((term) => term.length > 0);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term}"*`).join(" ");
}

export const loader = defineHandler(async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  const ftsQuery = toFtsQuery(q);
  if (!ftsQuery) return { q, cards: [] as CardResult[] };

  const cards = await db.all<CardResult>(sql`
    SELECT
      cards.oracle_id AS oracleId,
      cards.name AS name,
      cards.mana_cost AS manaCost,
      cards.type_line AS typeLine,
      COALESCE(
        json_extract(cards.image_uris, '$.normal'),
        json_extract(cards.card_faces, '$[0].imageUris.normal')
      ) AS imageUrl
    FROM cards_fts
    JOIN cards ON cards.oracle_id = cards_fts.oracle_id
    WHERE cards_fts MATCH ${ftsQuery}
      AND cards.layout NOT IN ${HIDDEN_LAYOUTS}
    ORDER BY bm25(cards_fts), cards.edhrec_rank IS NULL, cards.edhrec_rank
    LIMIT ${RESULT_LIMIT}
  `);

  return { q, cards };
});

export const head = defineHead<Props>((_c, props) => ({
  title: props.q ? `${props.q} - Card search` : "Card search",
}));
