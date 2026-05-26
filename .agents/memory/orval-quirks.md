---
name: Orval codegen quirks
description: Non-obvious Orval config requirements that caused failures and must be preserved
---

# Orval Codegen Quirks

## Zod output must use mode: "single"
The zod output in `lib/api-zod/orval.config.ts` must have `mode: "single"` and no `schemas` option. Using `mode: "split"` or adding a `schemas` key causes TS2308 duplicate export errors.

**Why:** Multiple files with the same export names collide in the barrel export.

**How to apply:** After any OpenAPI changes, run `pnpm --filter @workspace/api-spec run codegen`. If you see TS2308, check the orval config first.

## api-zod tsconfig needs dom lib
`lib/api-zod/tsconfig.json` must include `"lib": ["esnext", "dom"]`. Without `dom`, `File` and `Blob` types used in upload schemas are undefined.

**Why:** The zod schemas reference browser File/Blob types for upload endpoints.
