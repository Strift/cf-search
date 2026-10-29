// Pull the Scryfall "Oracle Cards" bulk file and upsert it into the `cards`
// table of the local D1 database (or the deployed one with --remote).
//
//   node scripts/import-cards.ts [--remote] [--url <jsonl.gz url>]
//
// The bulk file has one card per oracle_id. Rows are written as SQL and loaded
// with `wrangler d1 execute --file`, which streams large files to D1.

import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

const BULK_DATA_URL = "https://api.scryfall.com/bulk-data/oracle-cards";
const SCRYFALL_HEADERS = { "User-Agent": "cf-search/0.1", Accept: "application/json" };
const WRANGLER_CONFIG = ".void-wrangler.jsonc";
const SQL_PATH = ".void/import/cards.sql";
// D1 rejects statements above 100 KB.
const MAX_STATEMENT_BYTES = 90_000;
const COLOR_ORDER = ["W", "U", "B", "R", "G"];

type Json = Record<string, unknown>;

const COLUMNS = [
  "oracle_id",
  "scryfall_id",
  "name",
  "layout",
  "mana_cost",
  "cmc",
  "type_line",
  "oracle_text",
  "power",
  "toughness",
  "loyalty",
  "defense",
  "colors",
  "color_identity",
  "keywords",
  "legalities",
  "rarity",
  "set_code",
  "set_name",
  "collector_number",
  "released_at",
  "edhrec_rank",
  "image_uris",
  "card_faces",
  "updated_at",
] as const;

type Row = Record<(typeof COLUMNS)[number], string | number | null>;

function parseArgs(argv: string[]) {
  const remote = argv.includes("--remote");
  const urlIndex = argv.indexOf("--url");
  const url = urlIndex === -1 ? undefined : argv[urlIndex + 1];
  if (urlIndex !== -1 && !url) throw new Error("--url needs a value");
  return { remote, url };
}

async function resolveDownloadUrl(): Promise<string> {
  const res = await fetch(BULK_DATA_URL, { headers: SCRYFALL_HEADERS });
  if (!res.ok) throw new Error(`Scryfall bulk-data lookup failed: ${res.status}`);
  const data = (await res.json()) as { jsonl_download_uri?: string; updated_at?: string };
  if (!data.jsonl_download_uri) throw new Error("Scryfall bulk-data has no jsonl_download_uri");
  console.log(`Oracle cards updated at ${data.updated_at}`);
  return data.jsonl_download_uri;
}

function colorString(colors: unknown): string {
  if (!Array.isArray(colors)) return "";
  return COLOR_ORDER.filter((c) => colors.includes(c)).join("");
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function json(value: unknown): string | null {
  return value == null ? null : JSON.stringify(value);
}

function toFace(face: Json) {
  return {
    name: face.name,
    manaCost: str(face.mana_cost),
    typeLine: str(face.type_line),
    oracleText: str(face.oracle_text),
    colors: Array.isArray(face.colors) ? colorString(face.colors) : null,
    power: str(face.power),
    toughness: str(face.toughness),
    loyalty: str(face.loyalty),
    defense: str(face.defense),
    imageUris: face.image_uris ?? null,
  };
}

// Multi-face layouts (transform, modal_dfc, ...) carry cost, text, colors and
// stats on the faces only; fold them back onto the row so every card can be
// filtered and searched the same way.
function toRow(card: Json, importedAt: string): Row {
  const faces = Array.isArray(card.card_faces) ? (card.card_faces as Json[]) : null;
  const front = faces?.[0];
  const faceText = faces?.map((f) => f.oracle_text).filter(Boolean);
  const colors = Array.isArray(card.colors)
    ? card.colors
    : (faces?.flatMap((f) => (Array.isArray(f.colors) ? f.colors : [])) ?? []);

  return {
    oracle_id: card.oracle_id as string,
    scryfall_id: card.id as string,
    name: card.name as string,
    layout: card.layout as string,
    mana_cost: str(card.mana_cost) ?? str(front?.mana_cost),
    cmc: card.cmc as number,
    type_line: card.type_line as string,
    oracle_text: str(card.oracle_text) ?? (faceText?.length ? faceText.join("\n//\n") : null),
    power: str(card.power) ?? str(front?.power),
    toughness: str(card.toughness) ?? str(front?.toughness),
    loyalty: str(card.loyalty) ?? str(front?.loyalty),
    defense: str(card.defense) ?? str(front?.defense),
    colors: colorString(colors),
    color_identity: colorString(card.color_identity),
    keywords: JSON.stringify(card.keywords ?? []),
    legalities: JSON.stringify(card.legalities ?? {}),
    rarity: card.rarity as string,
    set_code: card.set as string,
    set_name: card.set_name as string,
    collector_number: card.collector_number as string,
    released_at: card.released_at as string,
    edhrec_rank: typeof card.edhrec_rank === "number" ? card.edhrec_rank : null,
    image_uris: json(card.image_uris ?? front?.image_uris),
    card_faces: faces ? JSON.stringify(faces.map(toFace)) : null,
    updated_at: importedAt,
  };
}

function literal(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

const UPSERT_PREFIX = `INSERT INTO cards (${COLUMNS.join(", ")}) VALUES\n`;
const UPSERT_SUFFIX = `\nON CONFLICT(oracle_id) DO UPDATE SET ${COLUMNS.filter(
  (c) => c !== "oracle_id",
)
  .map((c) => `${c} = excluded.${c}`)
  .join(", ")};\n`;

async function writeSql(url: string, sqlPath: string): Promise<number> {
  const res = await fetch(url, { headers: SCRYFALL_HEADERS });
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);

  const importedAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  const out = createWriteStream(sqlPath);
  let batch: string[] = [];
  let batchBytes = 0;
  let count = 0;

  const flush = () => {
    if (batch.length === 0) return;
    out.write(UPSERT_PREFIX + batch.join(",\n") + UPSERT_SUFFIX);
    batch = [];
    batchBytes = 0;
  };

  const lines = createInterface({
    input: Readable.fromWeb(res.body as unknown as NodeReadableStream).pipe(createGunzip()),
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const values = `(${COLUMNS.map((c) => literal(toRow(JSON.parse(line), importedAt)[c])).join(", ")})`;
    if (batchBytes + values.length > MAX_STATEMENT_BYTES) flush();
    batch.push(values);
    batchBytes += values.length;
    count++;
    if (count % 5000 === 0) console.log(`  ${count} cards`);
  }
  flush();
  await pipeline(Readable.from([]), out);
  return count;
}

// wrangler prints one result object per statement; keep that out of the log
// unless the command fails.
function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    stdio: ["inherit", "pipe", "inherit"],
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

const { remote, url } = parseArgs(process.argv.slice(2));

if (!existsSync(WRANGLER_CONFIG)) run("npx", ["void", "prepare"]);
mkdirSync(".void/import", { recursive: true });

const downloadUrl = url ?? (await resolveDownloadUrl());
console.log(`Downloading ${downloadUrl}`);
const count = await writeSql(downloadUrl, SQL_PATH);
console.log(`Wrote ${count} cards to ${SQL_PATH}`);

console.log(`Loading into ${remote ? "the deployed" : "the local"} D1 database`);
run("npx", [
  "wrangler",
  "d1",
  "execute",
  "DB",
  "--config",
  WRANGLER_CONFIG,
  "--file",
  SQL_PATH,
  "--yes",
  ...(remote ? ["--remote"] : ["--local", "--persist-to", ".void"]),
]);
console.log(`Imported ${count} cards`);
