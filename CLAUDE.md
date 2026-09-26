# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # next dev
npm run build      # next build — run before assuming a change is deployable
npm run typecheck  # tsc --noEmit — the fastest correctness check
npm run lint       # eslint . — flat config in eslint.config.mjs
npm run package    # assemble .next/standalone for self-hosting (see below)
```

There is no test suite. `typecheck`, `lint` and a build are the only automated verification, so all three matter.

`lint` runs the ESLint CLI, not `next lint`: that command is deprecated in Next 15 and removed in 16, and ESLint was never actually a dependency here, so the old script only ever opened an interactive setup prompt. `eslint-config-next` is pinned to the same major as `next`.

`next dev` holds file handles on Windows: a `git mv` of a watched directory fails with `EACCES` until the dev server is stopped. Stale `.next` output after moving routes produces a misleading `Cannot find module for page: /x` at build time — delete `.next` and rebuild before investigating further.

## Architecture

### Elysia runs inside Next.js, not beside it

The whole API is one Elysia instance in `server/app.ts`, mounted at `app/api/[[...slugs]]/route.ts` by exporting `api.handle` for each HTTP method. It is never started with `.listen()`.

This is deliberate. Elysia targets Bun; Vercel's serverless runtime is Node. Because `.handle(request)` takes a standard `Request` and returns a `Response` — the same pair Next route handlers use — no Bun runtime is involved and the whole app deploys as a single Next.js project with one serverless function. Do not add a separate server process or a `listen` call.

Route modules live in `server/routes/` and are composed with `.use()` in `server/app.ts`. A new route module must be registered there or it silently does not exist.

`/auth/discord` and its callback are plain Next route handlers, not Elysia, because they return redirects and gain nothing from typed responses.

### Types flow from the server to the client

`server/app.ts` exports `type Api`. `lib/client/eden.ts` feeds that into Eden Treaty, and `lib/client/queries.ts` wraps each call. Renaming or changing a route is therefore a compile error in the client rather than a runtime 404 — keep it that way by adding new calls to `queries.ts` instead of hand-writing `fetch`.

Only the type crosses the boundary; no server code is bundled into the client.

One wrinkle: `/rules-data/:type` serves four different shapes behind one route, so Eden infers the union of all of them. `queries.ts` narrows each literal back to its real type via a local `narrow<T>()` helper. That cast is intentional and belongs only there.

### Wire format

Inherited from the v2 Express API this project replaced:

- reads return the raw payload (an array or object)
- writes return `{ success, message, data }`
- failures return `{ error }` with a status code, produced centrally by `onError` in `server/app.ts`

Throw `ApiError(message, status)` from `server/errors.ts` rather than returning an error shape by hand.

### Data layer is positional

`server/services/csv.ts` and `server/services/roster.ts` map Google Sheets **by column index** (`NamePD` C=code D=name F=rank…, weekly sheets A=name J=totalCases X=paid, AC–AI=duty). The column comments are the only specification. Reordering a sheet column breaks parsing silently — values land in the wrong fields rather than erroring.

Large read-only sheets come through Google's GViz CSV export; writes and the rules/cases sheets use the Sheets API.

### Serverless constraints

- `server/services/cache.ts`, `paymentStore.ts`, and `server/rateLimit.ts` are **instance-local**. Multiple Vercel instances do not share them — rate limits and idempotency keys throttle/dedupe per-instance, not globally.
- Long-running work at module scope runs on every cold start; avoid adding any.

### PIN auth: constant-time check plus a lockout

`server/errors.ts`'s `requirePin` compares the submitted PIN with `crypto.timingSafeEqual` (not `!==`) and tracks wrong attempts per client (via `server/rateLimit.ts`'s `clientKey`, best-effort from `X-Forwarded-For`), throwing 429 after 10 wrong attempts in 15 minutes. Every route that calls `requirePin` must pass its Elysia `request` object through — `requirePin(body, request)` — or lockout falls back to a single shared bucket for the whole instance.

`/register` and `/medical` are both rate-limited (10/min per client) via the same `rateLimit()` helper — apply the same call to any new public submission endpoint.

### The two admin consoles authorise on a Discord allowlist, not the PIN

`server/services/permissions.ts` gates both instead: the verified Discord id from the session cookie has to appear in a list the spreadsheet holds in two cells — the left one naming the list, the right one holding the ids (any separator, `<@id>` tolerated).

| page | routes | key cell | ids cell | key |
|---|---|---|---|---|
| `/rostermanage` | `routes/rosterAdmin.ts` | `NamePD!AA2` | `AB2` | `ROSTERMANAGE_IDDC` |
| `/proctor` | `routes/pending.ts` | `Pending!I1` | `J1` | `PROCTOR_IDDC` |

Adding a third console means adding a `PermissionSource`, not a second reader. `requirePermission` returns the actor's id, so a write can be attributed — the thing one shared PIN never could, and what `/pending/approve` now records as the proctor instead of believing an id sent in the body.

Consequences worth knowing before changing it:

- **The list is not a credential.** An id only works for whoever can log into that Discord account, which is why it is safe in a sheet other people can read. `ADMIN_PIN` would not be — never move it there.
- Read through the Sheets API, not GViz: the GViz export is CDN-cached, so a revoked id would keep working for minutes.
- Those two cells are positional like the rest of the sheet layer, so the key cell is **verified** rather than assumed. An inserted row reports itself instead of silently reading whatever slid into AA2.
- `ROSTERMANAGE_IDDC` and `PROCTOR_IDDC` in the environment are standby lists, merged in on every path including the failure ones. They are what stops a mistyped cell from locking the last admin out of the page that edits that cell. They do not help if Discord OAuth itself breaks — nothing short of a non-Discord gate would.
- Each page asks its `access` endpoint on load because the session cookie is HttpOnly. Without that call a refresh looks like a logout.

`ADMIN_PIN` still guards `/refresh`, `/mark-paid` and the rules/fines/conduct CRUD, so `requirePin` and the admin cookie are still live — they are simply no longer what stands between anyone and the roster.

### Google Sheets lags its own writes

The GViz export is CDN-cached, so re-reading a week immediately after marking it paid can still report it unpaid. `components/profile/ProfileClient.tsx` keeps a `paidThisSession` ref that overrides re-fetched data. Payments also carry idempotency keys, and a request lost to the 10s timeout is resolved by querying `/api/mark-paid/status` rather than being reported as a failure — that machinery exists to avoid double-paying someone, so do not simplify it away.

### Self-hosting outside Vercel (DirectAdmin is the primary target)

`next.config.mjs` sets `output: 'standalone'`, so a build emits `.next/standalone` — the server plus only the dependencies it traced, runnable with `node server.js` and no install or build on the target host. That matters for panel hosting (DirectAdmin's Node.js Selector, cPanel), where `next build` routinely exceeds the available memory — always build locally and upload the assembled bundle, never build on the panel host itself.

`next build` deliberately leaves two things out of that folder, because on Vercel the CDN serves them:

- `.next/static` — omitting it serves the site with **no CSS or JS**
- `public/` — omitting it 404s the logo

`npm run package` copies both in, and also deletes the `.env` that `next build` bundles into `.next/standalone/.env` **with real secret values** — the host's own environment settings should supply those instead. Run `build` then `package`; uploading a bundle assembled by hand is how the missing-CSS failure reappears.

## Configuration

`SHEET_ID`, `CASES_SHEET_ID`, `RULES_SHEET_ID` and `ADMIN_PIN` are lazy getters in `server/config.ts` that throw when unset. A missing variable surfaces as a 500 naming the variable on the first request that needs it, not as a boot failure — so the site renders and only the affected endpoints fail. See `.env.example` for the full variable list.

`GOOGLE_JSON_KEY` holds the entire service-account JSON as a single-line string. A panel that writes environment variables into `.htaccess` as `SetEnv` truncates a value that long at its first space, which surfaces as `GOOGLE_JSON_KEY is not valid JSON` — there, leave it unset and point `GOOGLE_APPLICATION_CREDENTIALS` at the JSON file instead, keeping that file outside the web-served directory.

**Discord OAuth requires three things to agree exactly**: `APP_URL`, the host actually serving the site, and the redirect registered in the Discord Developer Portal. A mismatch — including `www` vs apex — makes Discord refuse to return from login, with no useful error. `redirectUri()` strips trailing slashes from `APP_URL` for this reason.

## Styling

Tailwind v4, configured CSS-first through `@theme` in `app/globals.css`. Design tokens were ported from the v2 stylesheet; prefer them over new literals.

**Do not create a color token whose name collides with a Tailwind utility scale.** A `--color-base` token generates a `text-base` color utility that collides with the built-in font-size utility, silently rendering text in the wrong color. This happened; the token is now named `night`.
