# Application architecture

The existing root Vite application remains the marketing site. `apps/admin` is an independent Next.js App Router application with a modular server backend, MongoDB via Prisma 6, Better Auth sessions, Zod validation, and reusable UI primitives.

## Request flow

The browser requests a code from the WhatsApp auth endpoint. The server reserves a challenge transactionally, generates a cryptographically random code, stores only a keyed digest, and sends the approved Meta authentication template. Only acknowledged sends become verifiable. Delivery failures invalidate the challenge.

Verification compares the digest in constant time, enforces expiry/attempt limits, and transactionally consumes the challenge and creates or finds a verified user. Better Auth creates the opaque session token and signs its HttpOnly cookie. The JSON response contains only the next route. The cookie has SameSite=Lax and is Secure in production.

Unverified/inactive users cannot access tenant APIs. Requests load a verified session and resolve organization membership server-side. Business identity and team changes require OWNER/ADMIN; operational location changes also permit MANAGER; STAFF/VIEWER remain read-only. Business IDs, location IDs, and role assignments from the browser are never treated as authorization.

## MongoDB consistency

Multi-document writes use transactions on a replica set. Conflicts retry the complete operation. A write to the user document serializes initial workspace creation, replacing the previous PostgreSQL advisory lock. Profile updates retain revision-based optimistic concurrency, with a 409 on stale edits. Audit events commit with the relevant change.

MongoDB does not supply SQL foreign keys. All new write services must verify the organization/business ownership of every referenced document before writing. Current location mutations already enforce this. No public order/catalog write APIs exist yet.

## Boundaries

- `src/modules/auth`: challenges, verification policy, account initialization.
- `src/modules/whatsapp`: outbound authentication template adapter.
- `src/modules/business`: business/location/membership services and validation.
- `src/server`: auth session setup, authorization, transaction retries, API boundary.
- `prisma`: MongoDB model contract and opt-in demo seed.
- `scripts`: replica-set preview runtime and additional MongoDB indexes.

WhatsApp order ingestion, AI execution, menu imports, terminal integration, and online payments remain future work. The current Meta integration is strictly account verification. No messages are sent during automated tests.
