# Permission Upsert Seed Generator — blocks-release

Adapted from blocks-iam's `permission-upsert-seed-generic.md` for the
**blocks-release** (`Devops`) API. It produces a single MongoDB
upsert-ready JSON file at `server/seed/permissions.upsert.json`, one
document per protected endpoint.

Protected endpoints are now marked with `[ProtectedEndPoint("...")]`, the
same marker blocks-iam uses. The attribute argument **is** the permission's
`Resource`, so the attribute string and the seed document must always be
edited together.

## Codebase-specific deviations from the generic MD

| Concern | Generic (blocks-idp) | blocks-release |
|---|---|---|
| Protection marker | `[ProtectedEndPoint("svc::action")]` | same |
| Public endpoints | absence of the attribute | same (e.g. `Github/webhook`, `Auth/TestPing`) |
| Service segment | `blocks-idp` | `blocks-release` |
| `ResourceGroup` | `"idp"` | `"release"` |
| Controllers dir | `server/Api/Controllers/**/*.cs` | same |

`blocks-release` (not `blocks-release-api`) is the service segment of the
resource string. `Program.cs` still uses `blocks-release-api` as the
*service name* for vault, config and log resolution — that is a separate
identifier and must not be renamed to match.

Everything else (document shape, constants, dedup, emit rules) is
unchanged from the generic MD.

## Expected document shape (canonical, MongoDB Extended JSON v2)

```jsonc
{
  "_id": "a6b0cc3c-ea31-47cb-8a78-1aa3afb91ab8",
  "CreatedDate": ISODate("2026-07-09T11:38:01.473+0000"),
  "LastUpdatedDate": ISODate("2026-07-09T11:38:01.473+0000"),
  "CreatedBy": "1554751b-e91c-4ea4-8500-cdaf714b248e",
  "Language": null,
  "LastUpdatedBy": "1554751b-e91c-4ea4-8500-cdaf714b248e",
  "OrganizationIds": [],
  "Tags": [],
  "Name": "View Connected Repositories",
  "Type": NumberInt(1),
  "Description": "List the repositories connected to the tenant for building and deployment. Covers: GET /Build/repos-list.",
  "Resource": "blocks-release::build::repos-list",
  "ResourceGroup": "release",
  "IsBuiltIn": true,
  "IsArchived": false,
  "PermissionSeverity": NumberInt(4),
  "DependentPermissions": [],
  "Roles": [],
  "OrganizationId": "default"
}
```

`ISODate(...)` and `NumberInt(...)` are Extended JSON v2 — load via
`mongoimport` / `mongosh` / the C# driver's `BsonDocument.Parse`, not raw
`JSON.parse`.

## Step 1 — Discover

Scan `server/Api/Controllers/**/*.cs`. A **protected endpoint** is any
action method carrying `[ProtectedEndPoint("...")]`.

Exclude:

- Actions without the attribute — they are public by design (e.g.
  `Github/webhook`, which authenticates via HMAC signature, and
  `Auth/TestPing`).
- Commented-out actions (e.g. `Build/DatagatewayPipelineInitiate`).

Emit a per-file count of protected actions found.

## Step 2 — Derivation rules

For each protected action, `Resource = "<service>::<controller>::<action>"`,
lowercase kebab-case throughout:

1. **service** = `blocks-release` (no `-api` suffix).
2. **controller** = kebab-case of the controller class name minus the
   `Controller` suffix (`AnalyticsToolController` -> `analytics-tool`,
   `AuthController` -> `auth`, `BuildController` -> `build`,
   `GithubController` -> `github`).
3. **action** = a **meaningful noun phrase for the thing being acted on** —
   *not* an HTTP verb and *not* prefixed with one. `get-`/`post-`/`delete-`
   carry no information the `Name` does not already carry, and they make the
   resource churn whenever a route's verb changes.
   - Start from the route slug (`[HttpGet("repos-list")]` -> `repos-list`).
   - If the route has no slug (a bare `[HttpGet]`), or the slug alone is not
     self-describing, use a noun phrase instead: bare `GET /Build` ->
     `details`; `POST /Build/manual` -> `manual-build`;
     `GET /Build/settings` (returns hosting providers) -> `hosting-providers`.
   - Where verb and noun are the same word, keep the single word: `clone`,
     `reports`, `branches`.
4. **Name** = a short human-readable action phrase in title case —
   `View Connected Repositories`, `Run Build`, `Provision SonarQube User`.
   It is what an administrator reads in the role editor, so it must state
   the action and the object without jargon. It is **not** the resource
   string.
5. **Description** = one to three sentences: what the permission grants,
   then `Covers: <METHOD> <route>` naming the exact endpoint(s), then any
   side effect or blast radius worth flagging (consumes build
   infrastructure, disconnects GitHub, writes to the build host, …).
6. **PermissionSeverity** — int `(None=0, Critical=1, High=2, Medium=3,
   Low=4)`, keyed on the endpoint's **HTTP method attribute** (the resource
   string no longer carries the verb):
   - **Low (4):** `HttpGet` — reads.
   - **High (2):** `HttpDelete`.
   - **None (0):** `HttpPost` / `HttpPut` (see caveats — these should be
     reviewed and reclassified).
7. **_id** = fresh GUID per entry, stable across regenerations (do not
   re-roll `_id` when only `Name`/`Description`/`Resource` change, or the
   upsert will duplicate the permission instead of updating it).
8. **CreatedDate / LastUpdatedDate** = one UTC timestamp captured once,
   reused for every entry, rendered as `ISODate("...")`.
9. **CreatedBy / LastUpdatedBy** = one synthetic system GUID captured once,
   reused for every entry (not the literal `"system"`).
10. **Constants:** `Type = NumberInt(1)`, `IsBuiltIn = true`,
    `IsArchived = false`, `ResourceGroup = "release"`,
    `OrganizationId = "default"`, `OrganizationIds = []`,
    `DependentPermissions = []`, `Roles = []`, `Tags = []`,
    `Language = null`.

## Step 3 — Deduplicate

Collapse by `Resource`; keep the first occurrence and report drops as
`Resource -> file:line`. Because the verb is no longer part of the resource,
two endpoints on the same route with different verbs would now collide —
give them distinct noun phrases (`remove-authorization` vs
`delete-authorization`) rather than reintroducing the verb prefix.

## Step 4 — Emit

- Path: `server/seed/permissions.upsert.json` (create dir if missing).
- Top-level JSON array, 4-space indent, no trailing comma, trailing
  newline, UTF-8 without BOM.
- Field order per document:
  `_id, CreatedDate, LastUpdatedDate, CreatedBy, Language, LastUpdatedBy,
  OrganizationIds, Tags, Name, Type, Description, Resource, ResourceGroup,
  IsBuiltIn, IsArchived, PermissionSeverity, DependentPermissions, Roles,
  OrganizationId`.
- Every `Resource` must match a `[ProtectedEndPoint("...")]` argument
  verbatim, and vice versa. Verify with:
  `grep -oh 'blocks-release::[^"]*' -r server/Api/Controllers | sort` against
  the `Resource` values in the seed.
- Validate by stripping `ISODate(...)` / `NumberInt(...)` and parsing with
  `jq` / `ConvertFrom-Json`, or by loading with `BsonDocument.Parse`.

## Step 5 — Report

Print: protected-action count, unique-resource count, dropped duplicates,
first/middle/last sample docs, `None`-severity outliers, and the GUID +
timestamp used.

## Current inventory (as generated)

21 protected endpoints, 0 duplicates. Severity: Low = 15 (GET), High = 1
(DELETE), None = 5 (POST — review recommended).

| Resource | Name |
|---|---|
| `blocks-release::analytics-tool::dependency-track-user` | Provision Dependency Track User |
| `blocks-release::analytics-tool::sonar-qube-user` | Provision SonarQube User |
| `blocks-release::auth::authorization-status` | View Git Provider Authorization Status |
| `blocks-release::auth::access-token` | Exchange Git Provider OAuth Code |
| `blocks-release::auth::remove-authorization` | Revoke Git Provider Authorization |
| `blocks-release::auth::delete-authorization` | Delete Stored Git Provider Token |
| `blocks-release::build::details` | View Build Details |
| `blocks-release::build::repos-list` | View Connected Repositories |
| `blocks-release::build::repo-details` | View Repository Details |
| `blocks-release::build::repo-domain-update` | Update Repository Domain |
| `blocks-release::build::run-build` | Run Build |
| `blocks-release::build::manual-build` | Trigger Manual Build |
| `blocks-release::build::repo-settings-update` | Update Repository Build Settings |
| `blocks-release::build::hosting-providers` | View Hosting Providers |
| `blocks-release::build::reports` | View Build Test Reports |
| `blocks-release::github::user` | View GitHub Account |
| `blocks-release::github::repos` | Search GitHub Repositories |
| `blocks-release::github::branches` | View GitHub Branches |
| `blocks-release::github::branch-exists` | Check GitHub Branch Exists |
| `blocks-release::github::clone` | Clone GitHub Repository |
| `blocks-release::github::create-webhook` | Create GitHub Webhook |

## Notes / caveats

- **Renaming a `Resource` is a breaking change.** The seed upserts by `_id`,
  so an existing permission is updated in place — but any role or client
  check still referencing the old string stops matching. Re-run the seed and
  the attribute rename together.
- **Roles are intentionally empty** — the seed grants nothing. Attach roles
  via the mutation API.
- **POST verbs map to `None` (0)** severity. The five POST endpoints
  (`repo-domain-update`, `run-build`, `manual-build`,
  `repo-settings-update`, `auth::remove-authorization`) all mutate state and
  should be reclassified to Medium/High before shipping.
- **`_id` and the seed timestamps are frozen** at their original generated
  values so re-running the seed updates rather than duplicates.
- **No generator script committed** — only the JSON + this MD are produced.
