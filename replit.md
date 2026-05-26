# GlobalChat

A full-featured real-time community chat platform with group channels, private DMs, Clerk authentication, and an admin dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, shadcn/ui, Tailwind CSS, Wouter, TanStack Query
- API: Express 5 + WebSocket (ws package) at `/ws`
- Auth: Clerk (cookie-based, proxy middleware at `/api/__clerk`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → `lib/api-client-react`)
- Build: esbuild (ESM bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM schema (users, groups, messages, contacts, activity)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/websocket.ts` — WebSocket broadcast helper
- `artifacts/chat-app/src/` — React frontend
- `artifacts/chat-app/src/pages/admin/dashboard.tsx` — Admin dashboard
- `lib/api-client-react/src/generated/api.ts` — Generated hooks (do not edit)

## Architecture decisions

- First registered user automatically becomes admin (only one admin role).
- Uploads use base64 JSON (not multipart/form-data) to avoid Orval File/Blob type complications.
- WebSocket path `/ws` is served on the same HTTP server instance as Express (shares port 8080).
- Clerk is proxied through `/api/__clerk` so cookies work across the single Replit domain.
- Messages table handles both group messages (groupId set) and DMs (recipientId set) in one table.

## Product

- **Landing page**: Marketing page with Sign In / Get Started
- **Auth**: Google + email/password via Clerk
- **Group chat**: Join public groups, send real-time messages, see member counts
- **Direct messages**: Add contacts first, then DM them privately
- **File sharing**: Upload images and files in messages
- **Real-time**: WebSocket pushes new messages and ban events instantly
- **Admin dashboard**: Stats overview, ban/unban users, create/delete groups, activity log
- **Ban system**: Banned users see a block screen instead of the chat

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/db run push` after changing schema files.
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`.
- The `lib/api-zod/tsconfig.json` needs `"lib": ["esnext", "dom"]` to avoid File/Blob type errors.
- The Orval zod output must use `mode: "single"` and no `schemas` option to avoid duplicate export errors.
- Upload endpoint uses base64 JSON body — do not switch to multipart/form-data without updating types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
