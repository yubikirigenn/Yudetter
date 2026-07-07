---
name: Orval path+query param collision
description: When an endpoint has both path params AND query params, Orval generates a *Params Zod schema in api.ts AND a TypeScript type in types/, causing TS2308 collision in api-zod barrel.
---

## The Rule

Endpoints with **both** path parameters AND query parameters cause TS2308 collisions in `lib/api-zod` after codegen.

**Why:** Orval generates `{OperationIdPascal}Params` in both `generated/api.ts` (Zod schema) and `generated/types/*.ts` (TS interface). The barrel `export *` from both causes duplicate exports.

**Endpoints with only query params** (no path params) do NOT trigger this — Orval only generates the TS type, not the Zod schema.

**How to apply:** For any new endpoint with path params, do NOT add query params inline. Options:
1. Remove query params for the first build, add later with components/parameters approach
2. Define params as `components/parameters` $refs (may or may not help — not tested)
3. Accept no pagination on path-param endpoints in v1

## Example

```yaml
# BAD — triggers collision for getFollowers
/users/{username}/followers:
  get:
    parameters:
      - name: username
        in: path
      - name: cursor
        in: query  # ← this causes collision

# GOOD — no collision
/users/{username}/followers:
  get:
    parameters:
      - name: username
        in: path
        # no query params
```
