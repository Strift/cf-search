import { defineHandler, defineHead, type InferProps } from "void";
import { db, sql } from "void/db";
import { parseSorting, type Sorting, HIDDEN_LAYOUTS } from "@/lib/search";

export type Props = InferProps<typeof loader>;

export type CardResult = {
  oracleId: string;
  name: string;
  imageUrl: string | null;
};

export type SetOption = { code: string; name: string };

// Server-side timings in milliseconds.
export type Trace = { search: number; sets: number; server: number };

const RESULT_LIMIT = 100;
const POPULARITY = sql`cards.edhrec_rank IS NULL, cards.edhrec_rank`;

// Same semantics as mtgbuilder.ai's buildMeilisearchSort; popularity breaks ties.
function orderBy(sort: Sorting, hasQuery: boolean) {
  switch (sort) {
    case "release_date":
      return sql`cards.released_at DESC, ${POPULARITY}`;
    case "cmc":
      return sql`cards.cmc ASC, ${POPULARITY}`;
    case "relevance":
      return hasQuery ? sql`bm25(cards_fts), ${POPULARITY}` : POPULARITY;
  }
}

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

async function timed<T>(run: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await run();
  return [result, Math.round(performance.now() - start)];
}

function searchCards(ftsQuery: string | null, set: string, sort: Sorting) {
  const where = sql`cards.layout NOT IN ${HIDDEN_LAYOUTS}${set ? sql` AND cards.set_code = ${set}` : sql``}`;
  const select = sql`
    SELECT
      cards.oracle_id AS oracleId,
      cards.name AS name,
      COALESCE(
        json_extract(cards.image_uris, '$.normal'),
        json_extract(cards.card_faces, '$[0].imageUris.normal')
      ) AS imageUrl`;
  const from = ftsQuery
    ? sql`FROM cards_fts JOIN cards ON cards.oracle_id = cards_fts.oracle_id WHERE cards_fts MATCH ${ftsQuery} AND ${where}`
    : sql`FROM cards WHERE ${where}`;
  return db.all<CardResult>(
    sql`${select} ${from} ORDER BY ${orderBy(sort, ftsQuery !== null)} LIMIT ${RESULT_LIMIT}`,
  );
}

function listSets() {
  return db.all<SetOption>(sql`
    SELECT cards.set_code AS code, cards.set_name AS name
    FROM cards
    WHERE cards.layout NOT IN ${HIDDEN_LAYOUTS}
    GROUP BY cards.set_code
    ORDER BY max(cards.released_at) DESC, cards.set_name
  `);
}

export const loader = defineHandler(async (c) => {
  const start = performance.now();
  const q = c.req.query("q")?.trim() ?? "";
  const set = c.req.query("set")?.trim() ?? "";
  const sort = parseSorting(c.req.query("sort"));

  // Sequential so each timing is attributable; the rest of `server` is
  // request handling overhead.
  const [cards, searchMs] = await timed(() => searchCards(toFtsQuery(q), set, sort));
  const [sets, setsMs] = await timed(listSets);

  const trace: Trace = {
    search: searchMs,
    sets: setsMs,
    server: Math.round(performance.now() - start),
  };
  return { q, set, sort, sets, cards, trace };
});

export const head = defineHead<Props>((_c, props) => ({
  title: props.q ? `${props.q} - Card search` : "Card search",
}));
