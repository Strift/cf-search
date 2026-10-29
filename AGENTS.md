<!--injected-by-void-v1.2.1-->

## Void

- This project uses [Void](https://void.cloud), a full-stack Vite framework for Cloudflare Workers with file-based API routing, server-rendered pages, and typed backend services.
- Use Void's CLI and typed APIs. Before working with Void, read the relevant Markdown docs in `node_modules/void/docs/`; start with `guide/quickstart.md` for setup and `reference/cli.md` for commands.

<!--/injected-by-void-->

## Local database

- Void runs a local D1 (SQLite) under `.void/`. `vpr dev` creates it and applies `db/migrations/` to it; `void db` commands target the same database unless you pass `--remote`. The deployed database only changes on `void deploy`.
- Edit `db/schema.ts`, then `npx void db generate` to write a migration and `npx void db migrate` to apply it locally.
- `pnpm import:cards` loads the Scryfall oracle cards into the local `cards` table (~20 s); `pnpm import:cards --remote` loads the deployed one.
- Query it with `npx void db execute "SELECT count(*) FROM cards"`.

## Rules chat (`/chat`)

- `routes/api/chat.ts` runs the rules agent (OpenRouter via the Vercel AI SDK, tools on the `mtg_rules`, `mtg_glossary` and `scryfall_cards` Meilisearch indexes). It reads `MEILISEARCH_URL`, `MEILISEARCH_KEY` (a search-only key), `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` (default `openai/gpt-4.1-mini`), declared in `env.ts`.
- Locally, put them in the root `.env` (the only dotenv file Void reads). In production, set them with `npx void secret put <NAME>`; `void deploy` fails if any required one is missing.
