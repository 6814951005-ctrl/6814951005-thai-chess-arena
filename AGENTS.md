# Project rules for Codex

Layout: client/ = Vite + React + Tailwind. server/ = Express + Mongoose.
Server module system: ES modules import - keep it.
Node version: 20 (match `node -v`).
Deployment target: ONE Vercel project. Client built to client/dist.
  API = one Vercel Function at api/index.js (repo root). Database = MongoDB Atlas.
  Uploaded files = Vercel Blob (public store). Local dev keeps using the disk.
Reference patterns: docs/deploy-patterns.md - follow them, adapted to this project.

Rules:
- Reply to me in Thai. Keep code, file names, commands and error messages in English.
- One change per request. Do not refactor code that the request does not mention.
- Never read, print or edit any .env file. Never hard-code secrets or URLs.
- Do not add npm packages without saying why first.
- Keep every existing test passing. Run the tests after a change and show the result.
- After editing, list every file you changed with one sentence on why.