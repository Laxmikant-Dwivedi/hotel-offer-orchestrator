# Hotel Offer Orchestrator

Aggregates overlapping hotel offers from two mock suppliers, dedupes hotels by name, and
selects the best (cheapest) offer per hotel. Orchestration is done with **Temporal.io**,
and deduped results are cached in **Redis**, which also does the price-range filtering.

## Approach / Notes

**Design decisions**

- The workflow calls both suppliers in parallel (`Promise.allSettled`, not sequential
  `await`s) so a slow or failing supplier doesn't hold up the other.
- Dedup keeps the cheaper of the two prices per hotel name; if only one supplier
  returned a given name, that offer passes through unchanged — no special-casing
  needed since the dedup is just "keep the lower price seen so far per name."
- Activities call the mock suppliers over real HTTP (`api:3000/supplierA/hotels`, not
  an in-process function call), even though `api` and `worker` could share code
  directly. This matches the assignment's "calls two mocked supplier APIs" framing
  and makes the outage simulation (`down=true` / `simulateDown=A|B`) exercise a real
  network failure + Temporal retry, not just a code branch.
- `api` and `worker` are two processes built from the same image (different `CMD`),
  mirroring how you'd actually split a web tier from a Temporal worker tier in
  production, rather than running the worker in-process with Express.
- Redis holds the deduped list as a sorted set scored by price specifically so
  `minPrice`/`maxPrice` filtering is a native `ZRANGEBYSCORE`, per the requirement
  that filtering happen "inside Redis" rather than in application code.
- `/api/hotels` re-runs the workflow (and overwrites the Redis entry) on every call
  rather than serving from cache first. Given the mock suppliers are static and
  cheap to call, freshness seemed more useful to demonstrate than a cache layer with
  its own invalidation logic — Redis here is the filtering engine more than a cache,
  though it does carry a TTL (`HOTELS_CACHE_TTL_SECONDS`, default 300s).

**Assumptions**

- Mock catalogs only give meaningful overlap for `delhi` and `mumbai`; `bangalore` has
  Supplier A-only data (exercises "only one supplier returned it"); any other city
  returns `[]` (exercises the "no results" case) rather than a 404, since an empty
  result set is a valid answer to "hotels in a city we don't have data for."
- `simulateDown` on `/api/hotels` isn't part of the assignment's required contract —
  it's a testing affordance so the optional "simulate one supplier being down"
  Postman scenario can exercise the actual workflow's degrade-gracefully path,
  instead of only hitting the raw mock endpoint directly with `down=true`.

**Known limitations**

- The `render.yaml` Blueprint (see "Deploying to Render" below) was written from
  Render's documented spec without a live account to verify against, and needed one
  round of fixes once actually tried against the dashboard (an invalid `port:` field).
  Treat it as a solid starting point, not a guaranteed one-click deploy.
- No auth, rate-limiting, or workflow-history query endpoints — out of scope for a
  mock aggregator exercise.

## Architecture

```
                 ┌─────────────┐        ┌──────────────────┐
   HTTP client ─▶│  api (Express) │──starts workflow──▶│ Temporal Server │
                 │  :3000       │        └──────────────────┘
                 │              │                 │
                 │ /supplierA   │◀── activities call back over HTTP ──┐
                 │ /supplierB   │                                     │
                 │ /api/hotels  │        ┌──────────────────┐         │
                 │ /health      │        │  worker (Temporal Worker) │─┘
                 └──────┬───────┘        └──────────────────┘
                        │
                        ▼
                    ┌────────┐
                    │ Redis  │  (deduped list stored as a sorted set,
                    └────────┘   scored by price — used for range filtering)
```

- **`api`** — Express HTTP server. Hosts the two mock supplier endpoints, the
  `/api/hotels` endpoint (which starts a Temporal workflow), and `/health`.
- **`worker`** — Temporal Worker process. Runs the `hotelAggregationWorkflow` and its
  activities, which call the supplier endpoints over HTTP (`api:3000` inside Docker).
- **`temporal`** — Temporal Server (`temporalio/auto-setup`), backed by Postgres.
- **`temporal-ui`** — Web UI for inspecting workflow executions (optional, for debugging).
- **`redis`** — Stores the deduped/best-priced offer list per city as a sorted set
  (`ZADD` with price as score), so min/max price filtering runs as a native
  `ZRANGEBYSCORE` call inside Redis rather than in application code.

Both `api` and `worker` are built from the same image; only the container `command`
differs (`node dist/index.js` vs `node dist/temporal/worker.js`).

## Workflow behavior

`hotelAggregationWorkflow(city)`:

1. Calls Supplier A and Supplier B activities **in parallel** (`Promise.allSettled`).
2. Dedupes by hotel `name`. If a name appears in both lists, keeps the cheaper offer.
   If only one supplier returns a hotel, that offer is kept as-is.
3. If a supplier ultimately fails (after Temporal's built-in activity retries are
   exhausted), the workflow logs a warning and proceeds with just the other
   supplier's results, instead of failing the whole request.
4. Returns the sorted (by price), deduped offer list to the API, which persists it to
   Redis and returns it to the client.

## API

### `GET /api/hotels?city=<city>`

Runs the aggregation workflow for `city` and returns the deduped list.

```json
[
  { "name": "Holtin", "price": 5340, "supplier": "Supplier B", "commissionPct": 20 },
  { "name": "Radison", "price": 5900, "supplier": "Supplier A", "commissionPct": 13 }
]
```

### `GET /api/hotels?city=<city>&minPrice=<min>&maxPrice=<max>`

Same as above, but filters the deduped list to the given price range using Redis
(`ZRANGEBYSCORE`) instead of filtering in-process. `minPrice`/`maxPrice` are each
optional; either can be supplied alone.

### `GET /api/hotels?city=<city>&simulateDown=A|B|both`

Testing helper: forces the workflow's call to the given supplier to fail (503), so you
can see the "one supplier down" resilience path end-to-end (workflow retries, then
degrades gracefully to the other supplier's results).

### `GET /health`

Reports the health of both mock suppliers and Redis.

```json
{
  "status": "healthy",
  "dependencies": {
    "supplierA": { "name": "Supplier A", "healthy": true, "latencyMs": 12 },
    "supplierB": { "name": "Supplier B", "healthy": true, "latencyMs": 9 },
    "redis": { "healthy": true }
  },
  "timestamp": "2026-09-18T08:09:45.198Z"
}
```

### Mock supplier endpoints

- `GET /supplierA/hotels?city=<city>` — static catalog for Supplier A.
- `GET /supplierB/hotels?city=<city>` — static catalog for Supplier B.
- Append `&down=true` to either to simulate that supplier returning `503`.

Cities with data in both catalogs: `delhi`, `mumbai` (plus `bangalore` on Supplier A
only, useful for the "only one supplier has it" path). Any other city returns `[]`.

## Running with Docker Compose (recommended)

Requires Docker Desktop / Docker Engine with Compose v2.

```bash
docker compose up -d --build
```

This starts: `postgresql`, `temporal`, `temporal-ui`, `redis`, `api`, `worker`.

Give Temporal Server a few seconds to finish its schema setup on first boot. Once it's
ready:

- API: http://localhost:3000
- Temporal Web UI: http://localhost:8080
- Redis: localhost:6379

Try it:

```bash
curl "http://localhost:3000/health"
curl "http://localhost:3000/api/hotels?city=delhi"
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=6000&maxPrice=15000"
```

Stop everything:

```bash
docker compose down
```

Add `-v` to also drop the Postgres volume backing Temporal's persistence.

### If the worker container restarts on first boot

`temporal` (auto-setup) can take longer to become ready than `worker`'s first
connection attempt, in which case the worker container exits and Docker restarts it
(`restart: on-failure`). This resolves itself within a few seconds once Temporal is up;
no action needed. `api` doesn't have this issue since it connects to Temporal lazily,
only when the first `/api/hotels` request comes in.

## Deploying to Render

[`render.yaml`](render.yaml) is a Blueprint that mirrors the Compose stack: Temporal
Server + Postgres (Temporal's persistence) + Redis + the `hotel-api` web service +
the `hotel-worker` background worker, plus Temporal UI.

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Render dashboard → **New** → **Blueprint** → select this repo/branch.
3. Render parses `render.yaml` and shows every service it's about to create. Review,
   then **Apply**.
4. First deploy takes a few minutes: Postgres provisions, Temporal runs its schema
   migration, then `hotel-api`/`hotel-worker` build from the repo `Dockerfile`.
5. Once `hotel-api` is live, its Render-assigned URL serves the same routes as local:
   `https://<hotel-api>.onrender.com/health`, `/api/hotels?city=delhi`, etc.

Costs & tradeoffs worth knowing before you click Apply:

- None of `temporal`, `temporal-ui`, `hotel-api`, or `hotel-worker` run on Render's
  free tier — image-based and background-worker services require a paid plan
  (`starter` in the Blueprint). Postgres and the Redis-compatible Key Value store do
  have free plans, but Render's free Postgres expires after a fixed retention window,
  not indefinitely — fine for a demo, not for something long-lived.
  If you only want to show the assignment is deployable without keeping it running,
  spin it up, verify the endpoints, then delete the services (or suspend them) from
  the dashboard afterward.
- If you'd rather not host Temporal Server yourself, swap `TEMPORAL_ADDRESS` on
  `hotel-api`/`hotel-worker` for a [Temporal Cloud](https://temporal.io/cloud)
  namespace and delete the `temporal`/`temporal-ui`/`temporal-postgres` blocks from
  `render.yaml` — fewer moving parts, but requires a separate Temporal Cloud account
  and mTLS client certs.
- This Blueprint was authored without a live Render account to verify field-by-field,
  so a couple of things are worth double-checking once the services exist in your
  dashboard:
  - **Internal networking**: services reference each other by hostname (`temporal:7233`,
    `http://hotel-api:3000`). This relies on Render's private networking between
    services in the same project — if `hotel-worker`'s logs show it can't resolve
    `temporal`, check each service's **Settings → Networking** for its actual internal
    address and update the corresponding env var to match.
  - **Postgres TLS**: Render's managed Postgres requires TLS. The Blueprint sets
    `POSTGRES_TLS_ENABLED=true` and disables host verification as a pragmatic default;
    if `temporal`'s logs show a TLS/certificate error, that's the first place to look.
  - **Ports on image-based services**: `temporal` and `temporal-ui` use `runtime: image`
    with an explicit `port:` field. If Render doesn't route traffic on the expected
    port, set it explicitly in that service's dashboard settings.

## Running locally without Docker

Requires Node.js 20+, a running Redis instance, and a running Temporal Server
(e.g. `temporal server start-dev` from the [Temporal CLI](https://docs.temporal.io/cli)).

```bash
npm install
cp .env.example .env   # adjust REDIS_HOST/TEMPORAL_ADDRESS if not on localhost
npm run build

# terminal 1 — API
npm start

# terminal 2 — Temporal worker
npm run start:worker
```

For iterative development, `npm run dev` / `npm run dev:worker` run both with
`ts-node-dev` (auto-restart on file changes).

## Testing with Postman

Import [`postman/Hotel-Offer-Orchestrator.postman_collection.json`](postman/Hotel-Offer-Orchestrator.postman_collection.json).
It ships with a `baseUrl` collection variable (default `http://localhost:3000`) and covers:

- **Health** — `/health`.
- **Mock Suppliers** — direct calls to both suppliers, plus a simulated-outage call.
- **Hotel Aggregation**:
  - Valid city with overlaps (`city=delhi`) — asserts a deduped array.
  - Redis-backed price filtering (`minPrice`/`maxPrice`).
  - City with no results (`city=chennai`) — asserts `[]`.
  - Missing `city` — asserts `400`.
  - Simulated supplier outage (`simulateDown=A` / `simulateDown=B`) — asserts the
    workflow degrades gracefully to the surviving supplier's offers only.

Each request has built-in test assertions (visible in Postman's "Test Results" tab).

## Project layout

```
src/
  index.ts                 Express app entrypoint (api service)
  config.ts                Env-driven configuration
  logger.ts                Minimal structured JSON logger
  types.ts                 Shared TypeScript types
  redisClient.ts            ioredis client
  suppliers/
    data.ts                 Static mock supplier catalogs
    router.ts               /supplierA/hotels, /supplierB/hotels
  routes/
    hotelsRouter.ts          /api/hotels
    healthRouter.ts          /health
  services/
    redisHotelStore.ts       Save/filter deduped hotels via Redis sorted sets
  temporal/
    workflows.ts             hotelAggregationWorkflow (dedup + best-price logic)
    activities.ts             fetchSupplierAHotels/BHotels, health checks
    worker.ts                 Temporal Worker entrypoint (worker service)
    client.ts                 Temporal Client helper used by the API
```

## Environment variables

See [`.env.example`](.env.example). Key ones:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API port |
| `SELF_BASE_URL` | `http://localhost:3000` | Base URL the Temporal activities use to call the mock supplier endpoints |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Redis connection |
| `REDIS_URL` | _(unset)_ | Full `redis://` connection string; overrides `REDIS_HOST`/`REDIS_PORT` when set (used on Render) |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal Server gRPC address |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_TASK_QUEUE` | `hotel-offer-task-queue` | Task queue shared by API (client) and worker |
| `HOTELS_CACHE_TTL_SECONDS` | `300` | TTL on the Redis sorted set per city |
