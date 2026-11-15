# ADR-0023: Hosting: Fly.io for the API and the worker, Neon for PostGIS, Cloudflare for the map and the web app

- Status: Accepted (2026-11-15; drafted at the user's request after the hosting comparison, and accepted by the user: "Accept it")
- Date: 2026-11-15
- Answers: HOST-1
- Builds on: ADR-0006 (users' locations), ADR-0009 (map tiles), ADR-0022 (coverage)

## Context

Deployment waits on HOST-1. specs/04 lists what any host must give us:
- the API and the worker as separate processes, with the worker's ingestion on a schedule;
- managed PostgreSQL with PostGIS;
- object storage that serves the map's PMTiles file, glyphs, and sprites with HTTP range requests (ADR-0009);
- HTTPS only;
- logs without query strings (ADR-0006) or tile paths (ADR-0009).

There's no funding, so the monthly cost matters most. Whether the app is commercial is still open (PRD-6), so free plans that exclude commercial use are flagged.

What was measured or checked on 2026-11-14, on the vendors' own pages (details and links in the shared research note `parking-host-1-comparison.md`):

- **The map file.** Since ADR-0022 it covers New York State and New Jersey. Their OpenStreetMap extracts are 475 MB and 157 MB, 0.71% of the 89 GB planet file. Protomaps' planet build for 2026-11-14 is 139.5 GB at zoom 0–15, so our extract should be about 1 GB (0.7–1.5 GB). `pmtiles extract --dry-run` gives the exact size without downloading anything.
- **The database.** The development database is 29 MB, with 2,056 active facilities and 7 MB of stored snapshots, which are pruned (ING-9).
- **Which logs see a location.**
  - The recommendations endpoint is `GET` with `lat` and `lng` in the query string. Any host or CDN log of full URLs would record rounded locations.
  - With a single PMTiles file, every tile request has the same path. The area viewed shows only in the `Range` header. So "drop tile paths" (ADR-0009) means, for PMTiles, "don't log byte ranges".
  - A third place is outside the brief: PostgreSQL's slow-query log writes a query's parameter values, which include the rounded coordinates.

## Options

Monthly costs are at low traffic, before a domain name. In every option the map file, glyphs, and sprites can go on Cloudflare R2: range requests, no egress fee, and 10 GB of storage and 10 million reads a month free. R2 is also Protomaps' recommended host for PMTiles.

1. **Fly.io + Neon Free + Cloudflare, about $7.40.**
   - **Fly:** two machines, shared-cpu-1x with 512 MB at $3.69 each, one for the API and one for the worker. Fly keeps only what the app prints; its proxy reports metrics and documents no per-request log.
   - **Neon Free:**
     - PostGIS, 1 GB of storage, 100 CU-hours and 5 GB of egress a month.
     - The database sleeps after 5 idle minutes, and on the free plan that can't be turned off. Pinned at 0.25 CU, 100 CU-hours is about 400 running hours.
     - The plan is aimed at "prototypes, side projects, and small teams". No ban on commercial use was found.
   - **Cloudflare's free plan** gives the customer no per-request logs: Instant Logs are Business and Enterprise only, Logpush Enterprise only.
   - **Effort:** medium.
2. **Render (Hobby workspace) + Cloudflare, about $20.30.**
   - A $7 web service and a $7 background worker. Render says not to use its free instances in production.
   - Render Postgres with PostGIS at $6 (256 MB), plus $0.30 per GB of storage.
   - Render generates HTTP request logs (with the path and client IP) only on Pro workspaces and above, so Hobby has none.
   - Hobby is described as "for individuals building personal projects"; the terms don't ban commercial use.
   - Hobby includes 5 GB of bandwidth, then $0.15 per GB.
   - **Effort:** low (one Blueprint). With Neon instead of Render Postgres, about $14.
3. **Railway (Hobby) + Cloudflare, about $8** (estimated from Railway's per-second rates).
   - Its HTTP logs always record the path, the client's IP, and the user agent. The docs don't say whether the path includes the query string, and they document no way to turn the logs off.
   - PostGIS only comes from community templates.
   - Not suitable unless the logs are shown to leave out query strings.
4. **DigitalOcean, about $25.**
   - App Platform containers at $5 each.
   - Managed PostgreSQL with PostGIS at $15.15.
   - Only build, deploy, and runtime logs are documented.
   - **Effort:** medium.
5. **AWS, about $29.**
   - Lightsail containers at $7 each and a $15 Lightsail database (PostGIS not confirmed). S3 and CloudFront for the map.
   - CloudFront's standard logs (v2) let us choose fields, so the query and range fields can be left out.
   - The account's free plan has to be upgraded to a paid plan first.
   - **Effort:** high.
6. **A Hetzner server, from €5.49 plus VAT.**
   - Every log is ours.
   - The database isn't managed: we would run PostgreSQL, its backups, and its updates.
   - **Effort:** high.

## Decision

- **API and worker:** Fly.io, as two apps from one Docker image, each with one shared-cpu-1x machine.
  - The API serves `/api` only.
  - The worker stays one long-lived process running its sources' cron expressions, as it does now (specs/04).
  - Both run in the same area as the database: Fly's Ashburn region and Neon's US East.
- **Database:** Neon's free plan, with PostGIS, compute pinned at 0.25 CU, and the direct (unpooled) connection string. The API and the worker are long-lived processes with small pools.
- **Map:** Cloudflare R2 holds the PMTiles file, cut from Protomaps' planet build to the coverage boxes (ADR-0022), with the glyphs and sprites beside it.
  - It's served from a custom domain on Cloudflare, not `r2.dev`, which is rate-limited and meant for development.
  - CORS allows only the web app's origin.
- **Web app:** Cloudflare's static assets for Workers serve the built app on the main domain.
  - The API is on a subdomain whose DNS record isn't proxied by Cloudflare, so nothing but Fly sits in front of it.
  - The web app calls the API cross-origin. The API allows the web app's origin (CORS) for its `GET` routes.
- **Logs:**
  - Fly keeps only what the processes print, and those follow PRIV-2 and ING-5 already.
  - Cloudflare's free plan has no request logs of ours to configure.
  - Neon's database logs are checked before launch (below).
- **If the free database runs short:**
  - When the app outgrows Neon's free compute, move to Neon's Launch plan ($0.106 per CU-hour). Always on at 0.25 CU that's about $19 a month more.
  - If PRD-6 makes the app commercial, re-check Neon's and Cloudflare's plans.

## Consequences

- About $7.40 a month at low traffic, plus a domain, which R2's production access needs anyway.
- The first search after 5 quiet minutes waits for Neon to wake. The API connects with a 2-second timeout, so check that the wake fits in it before launch.
- The user creates the accounts (Fly, Neon, Cloudflare) and buys the domain. Nothing was signed up for while drafting this.
- New work, as deployment tasks in specs/10:
  - a Dockerfile, and a Fly config for each app;
  - the API's CORS for the web app's origin, and a build-time API origin for the web app, passed to the API client's `baseUrl` option (WEB-3);
  - the production map style (`VITE_MAP_STYLE_URL`) pointing at our R2 domain (PRIV-4);
  - the R2 bucket's CORS;
  - a monthly job that cuts the map extract and uploads it to R2. It runs on Fly or in CI, and its R2 key is never logged, like the Socrata token (ING-5).
- Before launch, measure the worker's peak memory on the largest sources (the NJ and NY parcel layers) to confirm 512 MB is enough.
- Before launch, confirm Neon's database logs don't record query parameters, or that they can be turned off (PRIV-1).
- When this is accepted:
  - HOST-1 in docs/open-questions.md is marked decided;
  - specs/04's Deployment section is rewritten. Its "NYC and NJ map extract" already disagrees with ADR-0022's coverage.
