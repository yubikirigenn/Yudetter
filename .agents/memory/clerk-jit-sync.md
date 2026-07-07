---
name: Clerk JIT sync security
description: The /users/sync endpoint must derive clerkId from the verified Clerk session, not from the request body.
---

## The Rule

`POST /users/sync` (or any user provisioning endpoint) must derive the user's `clerkId` from `getAuth(req).userId` on the server side. Never trust `clerkId` from the request body.

**Why:** If the body's `clerkId` is trusted, any unauthenticated caller can create or update DB records for arbitrary Clerk IDs, enabling identity spoofing. The `requireAuth` middleware keys authorization off `users.clerk_id`, so a poisoned mapping breaks the entire auth chain.

**How to apply:**
```typescript
// Correct
const verifiedClerkId = getAuth(req).userId;
if (!verifiedClerkId) { res.status(401).json(...); return; }
// Ignore body.clerkId — use verifiedClerkId

// Wrong
const { clerkId } = req.body; // Never trust this
```

The body can still carry display data (username, displayName, email, avatarUrl) since these come from Clerk's own user object on the client, but the identity key must always be server-verified.
