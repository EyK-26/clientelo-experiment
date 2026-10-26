# Investiční přehled

A Czech educational demo built with Strata:
**SPY/VOO comparison → invented address capture → worksheet → print/PDF**.

[Open the demo](https://clientelo-experiment.onrender.com/etf)

**Render Free may take roughly a minute to wake. The demo is not advertising-ready.**
Only invented `@example.test` addresses are accepted. Nothing is emailed, address
ownership is not verified, and real public contact collection is disabled.

## Reviewer walkthrough

1. Read the comparison, broker-access warning and worksheet preview.
2. Submit an invented address such as `reviewer@example.test`. Other domains are rejected.
3. After successful acceptance, select **Otevřít celý pracovní list** to open the
   six-question worksheet, then **Tisk / uložit do PDF** to print or save it.
4. Submit the same address again to recover access without creating another contact.

Failed or pending submissions keep the input and leave the worksheet locked. Retry
explicitly after an error. Signed links last ten minutes; access can be recovered for
seven days after first acceptance. No login, newsletter subscription or email delivery
is involved.

## How it works

The page compares two S&P 500 ETFs for Czech beginners. Essential facts and access
limitations are public. The full worksheet adds six broker questions, space for answers
and sources, a glossary, fund identities and a draft message to a broker.

The app uses native Strata startup, routing, validation, Eta views, cookies/CSRF,
signed URLs, ORM repositories, transactions and migrations. Atomic database operations
suppress concurrent duplicates and preserve the original acceptance and attribution.
Small JavaScript enhancements handle form feedback and measurement; the core form and
worksheet also work without JavaScript.

- `src/modules/worksheet/`: capture, recovery, resource access and measurement.
- `src/models/`, `src/db/`: PostgreSQL persistence and migrations.
- `src/content/`, `views/`, `public/assets/`: sourced content, templates and assets.
- `tests/`: unit, integration and browser coverage.
- [ads/](ads/README.md): two advertisement drafts.
- [ai-log/](ai-log/README.md): genuine saved AI records; collection is paused.

## Run locally

Requires Bun **1.4.4** and PostgreSQL. Published Strata packages are pinned to **2.2.59**
in [package.json](package.json); install with the committed lockfile.

```sh
bun install --frozen-lockfile
cp .env.example .env
# Set DATABASE_URL, SESSION_SECRET, APP_URL and CSRF_TARGET_ORIGIN privately.
bun run start
```

Use a restricted database connection and matching application/CSRF origins. The default
configuration keeps capture disabled. No mail configuration is needed.

For the complete local synthetic journey, use the browser fixture below. Database
tests require an isolated loopback database named `clientelo_native_test` and separate
runtime, migration and deletion credentials in ignored local environment files.

```sh
bun run test
bun run check
bun --env-file=.private/environments/.env.test --env-file=.private/environments/.env.retention-test run test:integration

docker build -t investicni-prehled:demo .
bun --env-file=.private/environments/.env.test run test:container

bun --env-file=.private/environments/.env.test run test:browser:serve
# Open http://127.0.0.1:4335/etf; Ctrl+C cleans up the fixture.
```

Run database suites sequentially and stop the browser fixture before another suite.
Use `bun run test` for unit tests; do not run recursive `bun test tests`, which would
mix database fixtures. Automated browser instructions are in
[tests/browser/worksheet.mjs](tests/browser/worksheet.mjs).

## Hosting and database

The app runs on **Render Free**, service `clientelo-experiment`, with **Neon Free
PostgreSQL**. Render builds the root Dockerfile, starts the native Strata server and
uses `/health` for readiness. Automatic deployments are off.

Reviewer mode uses `APP_PROFILE=worksheet-qualification`, `WORKSHEET_CONTROLLED_TESTS=1`
and `WORKSHEET_PUBLIC_COLLECTION=0`. `APP_URL` and `CSRF_TARGET_ORIGIN` match the live
HTTPS origin; Render supplies its platform identity variables.

The runtime has read/insert/update access only to the three worksheet tables. Schema
changes run separately through `bun run db:migrate` with distinct migration/runtime
credentials. Administrative and deletion credentials must never enter the web service
or image. Migrations do not run during HTTP startup. Empty worksheet tables are healthy;
missing or inaccessible tables fail readiness.

The separate `worksheet:prune` CLI command deletes expired data using a deletion
identity. No automatic deletion schedule is enabled. For deployment rollback, select
a known-good image compatible with the current schema; an app rollback does not restore
database contents.

## Content, advertisements and measurement

“NYSE” means **NYSE Group primary listings, including NYSE Arca**. SPY and VOO are
compared educationally; listing does not establish availability to a Czech retail account.
Fund-sheet snapshots are dated **30 September 2026**, retrieved **25 October 2026**.
[Field-level primary sources and dates](src/content/etf-comparison.ts) include issuer
documents and broker KID policy. Account-specific purchase access remains unverified.

The section order is: demo/wake notice → headline and preview action → access warning →
comparison → worksheet sample → full-resource value → disclosed synthetic form → sources.
Visitors see the benefit and caveats before being asked for an address.

Both unpublished advertisements match the page: [A — compare beyond the index](ads/ad-a.svg)
and [B — check broker access](ads/ad-b.svg). [Attribution links](ads/README.md) distinguish
the variants without claiming real advertising traffic.

Measurement separates three outcomes:

- `accepted_new`: a newly committed synthetic contact. Retries and duplicates do not count again.
- `resource_open`: authorized worksheet access, separate from browser visibility.
- `print_attempt`: a print invocation, not proof of a saved PDF or physical print.

Submit clicks are not conversions. Browser observations are best effort; addresses
never enter analytics or URLs. [Measurement rules](src/modules/worksheet/measurement.ts)
define journey events and attribution. Conversion means new committed contacts divided
by eligible ad arrivals for the same campaign, variant and time window.

**Hypothetical forecast:** 3–8%, central 5%, for a future approved real-contact release
with suitable hosting and a credible purpose. Example: 1,000 arrivals × 80% usable page ×
25% form start × 25% accepted/start = 50 contacts. These assumptions are unmeasured;
there is no observed campaign conversion rate.

Three A/B hypotheses, ranked by expected impact:

1. A specific SPY/VOO and broker-access promise outperforms a generic ETF offer.
2. Showing the useful worksheet sample before the gate increases acceptance.
3. Clear pending/retry feedback reduces abandonment after submission problems.

## Verification and limitations

Local tests, typecheck and production-container checks pass. Hosted checks cover
validation, CSRF/origin rejection, input retention, synthetic-only admission, concurrent
duplicates, lost-response recovery, signed access, print invocation and persistence
after redeployment. Mobile layouts were checked at 360/390/430/1280px; the 390px view
was visually inspected. PDF generation was exercised.

Real collection remains disabled pending operator/privacy details and an approved
collection purpose, access and retention arrangements. Render's wake delay remains a
conversion limitation. Native Czech approval, physical-phone testing and account-specific
broker access are unverified. Synthetic checks are not campaign results, email
verification, physical printing or advertising-readiness evidence.
