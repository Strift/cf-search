import { sql } from "void/db";
import { index, integer, real, sqliteTable, text } from "void/schema-d1";

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// One row per Scryfall oracle_id (the card's rules identity, shared by all its
// printings). Imported from the Scryfall "Oracle Cards" bulk file by
// scripts/import-cards.ts. Nested Scryfall objects are kept as JSON text and
// read with SQLite's json_extract when needed.
export const cards = sqliteTable(
  "cards",
  {
    oracleId: text("oracle_id").primaryKey(),
    scryfallId: text("scryfall_id").notNull(),
    name: text("name").notNull(),
    layout: text("layout").notNull(),
    manaCost: text("mana_cost"),
    cmc: real("cmc").notNull(),
    typeLine: text("type_line").notNull(),
    oracleText: text("oracle_text"),
    power: text("power"),
    toughness: text("toughness"),
    loyalty: text("loyalty"),
    defense: text("defense"),
    colors: text("colors").notNull(),
    colorIdentity: text("color_identity").notNull(),
    keywords: text("keywords", { mode: "json" }).$type<string[]>().notNull(),
    legalities: text("legalities", { mode: "json" }).$type<Record<string, string>>().notNull(),
    rarity: text("rarity").notNull(),
    setCode: text("set_code").notNull(),
    setName: text("set_name").notNull(),
    collectorNumber: text("collector_number").notNull(),
    releasedAt: text("released_at").notNull(),
    edhrecRank: integer("edhrec_rank"),
    imageUris: text("image_uris", { mode: "json" }).$type<Record<string, string>>(),
    cardFaces: text("card_faces", { mode: "json" }).$type<CardFace[]>(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("cards_name_idx").on(table.name),
    index("cards_cmc_idx").on(table.cmc),
    index("cards_rarity_idx").on(table.rarity),
    index("cards_set_code_idx").on(table.setCode),
    index("cards_edhrec_rank_idx").on(table.edhrecRank),
  ],
);

export type CardFace = {
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  colors: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  defense: string | null;
  imageUris: Record<string, string> | null;
};
