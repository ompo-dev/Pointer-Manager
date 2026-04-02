# Point Manager Architecture

## Decision summary

- Frontend: Next.js App Router in `apps/web`
- Backend: Elysia in `apps/api`
- Persistence: Prisma + MySQL
- Contracts: OpenAPI in `packages/contracts/openapi`
- Client generation: Orval in `packages/api-client`
- Runtime package manager: Bun workspaces
- Real-time: server-authoritative WebSocket hub

## Why not true browser-to-browser P2P

For attendance, auditability is a hard requirement. True peer-to-peer would make it harder to guarantee ordering, replay, authorization, observability and non-repudiation of time records. The platform therefore uses a low-latency full-duplex channel, but the topology stays server-authoritative:

1. Commands enter through the API.
2. The API persists the transaction in Prisma.
3. The API emits a realtime event to subscribed dashboards.
4. Audit and analytics always read the authoritative state.

This preserves the real-time feel the product needs without sacrificing traceability.

## Bounded contexts

- `auth`: users, sessions, roles and authorization policies
- `plants`: plants, authorized networks, QR tokens and geofencing metadata
- `employees`: employee master data and assignment to plants
- `time-entries`: clock-in, clock-out, adjustments, active presence and realtime events
- `dashboard`: operational read models and alert projections
- `audit`: immutable administrative trail and replayable operational history

## Directory strategy

### apps/web

- `app/`: routes, layouts and coarse page composition
- `src/modules/`: feature modules and UI orchestrators
- `src/components/`: reusable primitives and shells
- `src/lib/`: axios transport, realtime hooks and helpers
- `src/store/`: Zustand state

### apps/api

- `src/domains/<context>/application`: use-cases and queries
- `src/domains/<context>/presentation`: HTTP adapters
- `src/core`: env, database and realtime hub
- `src/shared`: kernel abstractions and HTTP error mapping
- `prisma/`: schema and seed

## Immediate migration path

1. Keep legacy `artifacts/` as reference only.
2. Expand the new Elysia routes until every legacy endpoint has a new owner domain.
3. Replace ad hoc axios calls in `apps/web` with Orval-generated clients.
4. Introduce policy guards per role and per plant scope.
5. Add presence proof, network validation strategy and auto-closing policies as domain rules.
