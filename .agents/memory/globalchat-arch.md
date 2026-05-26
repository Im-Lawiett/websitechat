---
name: GlobalChat architecture
description: Key non-obvious decisions for the GlobalChat app that must stay consistent
---

# GlobalChat Architecture Decisions

## First user → admin
The first user to call `GET /api/users/me` (which creates their DB record) gets `role: "admin"`. Only one admin. Enforced in `artifacts/api-server/src/routes/users.ts`.

**Why:** Single-admin requirement. No separate seeding step needed.

**How to apply:** Never change the first-user check without understanding this is the only way to bootstrap an admin.

## Uploads via base64 JSON
The upload endpoint at `POST /api/uploads` accepts `{ fileName, fileType, fileData }` where `fileData` is a base64 string. Files are saved to `artifacts/api-server/uploads/` and served at `GET /api/uploads/:filename`.

**Why:** Orval-generated clients have trouble with `File`/`Blob` types in multipart forms. Base64 JSON avoids all that.

**How to apply:** Do not switch to multipart without also updating the Orval OpenAPI spec and regenerating.

## Clerk proxy
Clerk auth flows through `/api/__clerk` (proxied by `clerkProxyMiddleware`). Cookie auth is used — no Authorization headers. The `clerkMiddleware` wraps every request before routes are processed.

**Why:** Single Replit domain — the proxy makes Clerk cookies work.

## WebSocket on same port as Express
`initWebSocket(server)` in `artifacts/api-server/src/index.ts` attaches the `ws` WebSocket server to the same HTTP server as Express. Path is `/ws`, exposed via artifact.toml paths array.

**Why:** Simplicity — no separate WS port needed. The reverse proxy routes `/ws` to the API server.

## Messages table dual-use
One `messages` table handles both group messages (when `groupId` is set) and DMs (when `recipientId` is set). Never both at once.

**Why:** Simpler schema. One table to query for all message history.
