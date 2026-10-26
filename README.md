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
limitations are public. Before capture, a worked fee example and a sourced product-identity
answer demonstrate the resource, and all six checklist topics are visible. The full
printable worksheet brings the comparison and example together with six broker questions,
space for answers and sources, a glossary and a draft message to a broker.

The app uses native Strata startup, routing, validation, Eta views, cookies/CSRF,
signed URLs, ORM repositories, transactions and migrations. Atomic database operations
suppress concurrent duplicates and preserve the original acceptance and attribution.
Contacts expose native `events()` and `journeyEvents()` relationships; each event exposes
`contact()`, which returns no contact for a journey that has not accepted an address.
The winning acceptance creates its first event through `contact.events().create()` in
the same transaction; repeated resource opens use an atomic upsert.
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

Unit tests and typecheck need no database or private environment files:

```sh
bun run test
bun run check
```

For integration tests and the complete synthetic browser journey, use the supplied
disposable PostgreSQL container (Docker Compose required):

```sh
cp .env.test.example .env.test
docker compose -f compose.test.yaml up -d --wait
bun --no-env-file --env-file=.env.test run test:integration

docker build -t investicni-prehled:demo .
bun --no-env-file --env-file=.env.test run test:container

bun --no-env-file --env-file=.env.test run test:browser:serve
# Open http://127.0.0.1:4335/etf; Ctrl+C cleans up the fixture.

# After stopping the browser fixture:
docker compose -f compose.test.yaml down
```

The database is published only on `127.0.0.1:55432` and uses memory-backed disposable
storage. The deliberately public test passwords in `.env.test.example` are valid only
for this container. Never reuse them on a hosted service. Stopping the database container
discards its test data; no hosted URL, account or secret is needed.

The local owner/admin identity exists only to set up fixture schemas and exercise role
administration tests. Runtime and retention roles are separate and nonadministrative.
Native Strata fixtures create the application tables; the SQL initialization file only
creates these local roles and schema privileges. The browser harness removes owner and
retention URLs from its environment before booting the application. Runtime receives no
mail or hosting credentials. The committed production `.env.example` remains separate.

Run database suites sequentially and stop the browser fixture before another suite;
they create and remove their own tables in `clientelo_native_test`. A port conflict
should be resolved before startup, without repointing the tests at another database.
`bun run check` typechecks application code and TypeScript tests and rejects unused
local declarations and parameters.
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

Worksheet reads and writes use native models, relationships, repositories and
transactions. Explicit SQL remains for PostgreSQL role/grant administration, the
static connectivity probe, unchanged applied starter migrations and infrastructure
tests (catalog inspection, negative permission probes, schema namespaces and table
renames). The grant policy validates and quotes role names; tests quote generated
schema/table identifiers. Schema-builder operations are used where supported.
Atomic upserts and batch retention deletes remain native repository operations.

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
comparison → worked expense and product-identity examples → all six checklist topics →
disclosed synthetic form → sources and complete demo/hosting details. A compact reviewer
strip links to the complete disclosure, leaving room for the actual benefit and action
on mobile. Essential access warnings stay public and precede capture.

The static fee example applies each sourced annual percentage to an unchanged CZK-equivalent
value of 100,000: SPY 94.50 and VOO 30.00 per year. It assumes unchanged value, exchange rate
and fee. It is neither a return forecast nor a broker charge or all-in cost estimate;
commissions, conversion, spread and taxes are excluded. The same calculated content is
rendered in the preview and printable resource; fee data is not duplicated.

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

The checks above cover startup, source quality, calculations, validation, CSRF, retained
input, signed access, duplicate recovery, transactions, retention and restricted database
privileges. The container suite checks native startup, assets, concurrent submissions and
persistence across fresh containers. Browser checks cover the enhanced and no-JavaScript
journeys; print attempts do not establish a saved PDF or physical print.

This cleanup branch has not been deployed. Previous hosted observations do not qualify
its current revision. A fresh PDF inspection, native Czech approval, physical-phone testing
and account-specific broker access remain unverified.

Real collection remains disabled pending operator/privacy details, a genuine collection
purpose and approved access/retention arrangements. Synthetic checks are not campaign
results or email verification. Genuine AI conversation exports are absent from this
checkout; edited examples are not a substitute for authentic exports.

Render's wake page appears before the application runs. CSS or form feedback cannot remove
that platform delay; the existing free deployment remains unsuitable for advertising.
