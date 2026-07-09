# Permission Upsert Seed Generator — blocks-release

Adapted from blocks-iam's `permission-upsert-seed-generic.md` for the
**blocks-release** (`Devops`) API. It produces a single MongoDB
upsert-ready JSON file at `server/seed/permissions.upsert.json`, one
document per protected endpoint.

Unlike blocks-idp, this codebase has **no `[ProtectedEndPoint("...")]`
attribute**. It uses ASP.NET attribute routing plus `[Authorize]` to mark
protected endpoints, so discovery and resource derivation are adapted
accordingly (see Step 1 / Step 2).

## Codebase-specific deviations from the generic MD

| Concern | Generic (blocks-idp) | blocks-release |
|---|---|---|
| Protection marker | `[ProtectedEndPoint("svc::action")]` | `[Authorize]` on the action (or an `[Authorize]` controller) |
| Public endpoints | absence of the attribute | `[AllowAnonymous]` or absence of `[Authorize]` |
| Service segment | `blocks-idp-api` | `blocks-release-api` (repo `blocks-release`, `appsettings.json` `ServiceName: "release"`) |
| `ResourceGroup` | `"idp"` | `"release"` |
| Resource shape | attribute string, enriched to 3-part | URL/route style: `service::controller::<verb>-<path-slug>` |
| Controllers dir | `server/Api/Controllers/**/*.cs` | same |

Everything else (document shape, constants, dedup, emit rules) is
unchanged from the generic MD.

## Expected document shape (canonical, MongoDB Extended JSON v2)

```jsonc
{
  "_id": "25bbd2d2-1870-4e57-993f-6957034d4c8d",
  "CreatedDate": ISODate("2026-07-09T11:38:01.473+0000"),
  "LastUpdatedDate": ISODate("2026-07-09T11:38:01.473+0000"),
  "CreatedBy": "1554751b-e91c-4ea4-8500-cdaf714b248e",
  "Language": null,
  "LastUpdatedBy": "1554751b-e91c-4ea4-8500-cdaf714b248e",
  "OrganizationIds": [],
  "Tags": [],
  "Name": "blocks-release-api::build::get-repos-list",
  "Type": NumberInt(1),
  "Description": "",
  "Resource": "blocks-release-api::build::get-repos-list",
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
action method that is authorized:

- The action carries `[Authorize]`, OR its controller carries `[Authorize]`
  and the action is not `[AllowAnonymous]`.

Exclude:

- Actions/controllers marked `[AllowAnonymous]` (e.g.
  `DeploymentHubBroadcastController`).
- Actions with no `[Authorize]` (e.g. `Auth/TestPing`, `Github/webhook`).
- Commented-out actions (e.g. `Build/DatagatewayPipelineInitiate`).

Emit a per-file count of protected actions found.

## Step 2 — Derivation rules

For each protected action, `Resource = "<service>::<controller>::<action>"`,
lowercased:

1. **service** = `blocks-release-api`.
2. **controller** = kebab-case of the controller class name minus the
   `Controller` suffix (`AnalyticsToolController` -> `analytics-tool`,
   `AuthController` -> `auth`, `BuildController` -> `build`,
   `GithubController` -> `github`).
3. **action** = `<http-verb>-<path-slug>` (URL style):
   - `http-verb` = the action's HTTP method attribute, lowercased
     (`HttpGet` -> `get`, `HttpPost` -> `post`, `HttpDelete` -> `delete`).
   - `path-slug` = kebab-case of the route path segment after the
     controller. For `[Route("[controller]/[action]")]` controllers this
     is the action name; for explicit templates (`[HttpGet("repos-list")]`)
     it is that template string. A bare `[HttpGet]` on a
     `[Route("[controller]")]` controller has no segment, so the action is
     just the verb (e.g. `build::get`).
4. **Name** = `Resource` verbatim.
5. **PermissionSeverity** — int `(None=0, Critical=1, High=2, Medium=3,
   Low=4)`. First matching rule wins on the **first `-` token of the
   action** (which is the HTTP verb here):
   - **High (2):** `delete`, `deactivate`, `disable`, `revoke`, `archive`,
     `purge`, `terminate`
   - **Medium (3):** `create`, `update`, `save`, `assign`, `setup`,
     `verify`, `generate`, `regenerate`, `resend`, `enable`, `activate`,
     `restore`, `upload`, `import`, `export`, `sync`, `manage`
   - **Low (4):** `get`, `list`, `read`, `fetch`, `load`, `view`, `search`,
     `count`, `exists`, `check`
   - **None (0):** anything else (note: `post`/`put` are not in the tables,
     so write endpoints fall to `None` and should be reviewed).
6. **_id** = fresh GUID per entry.
7. **CreatedDate / LastUpdatedDate** = one UTC timestamp captured once,
   reused for every entry, rendered as `ISODate("...")`.
8. **CreatedBy / LastUpdatedBy** = one synthetic system GUID captured once,
   reused for every entry (not the literal `"system"`).
9. **Description** = `""` (fill later via the mutation API).
10. **Constants:** `Type = NumberInt(1)`, `IsBuiltIn = true`,
    `IsArchived = false`, `ResourceGroup = "release"`,
    `OrganizationId = "default"`, `OrganizationIds = []`,
    `DependentPermissions = []`, `Roles = []`, `Tags = []`,
    `Language = null`.

## Step 3 — Deduplicate

Collapse by `Resource`; keep the first occurrence and report drops as
`Resource -> file:line`.

## Step 4 — Emit

- Path: `server/seed/permissions.upsert.json` (create dir if missing).
- Top-level JSON array, 4-space indent, no trailing comma, trailing
  newline, UTF-8 without BOM.
- Field order per document:
  `_id, CreatedDate, LastUpdatedDate, CreatedBy, Language, LastUpdatedBy,
  OrganizationIds, Tags, Name, Type, Description, Resource, ResourceGroup,
  IsBuiltIn, IsArchived, PermissionSeverity, DependentPermissions, Roles,
  OrganizationId`.
- Validate by stripping `ISODate(...)` / `NumberInt(...)` and parsing with
  `jq` / `ConvertFrom-Json`, or by loading with `BsonDocument.Parse`.

## Step 5 — Report

Print: protected-action count, unique-resource count, dropped duplicates,
first/middle/last sample docs, `None`-severity outliers, and the GUID +
timestamp used.

## Current inventory (as generated)

21 protected endpoints, 0 duplicates. Severity: Low = 15 (GET),
High = 1 (DELETE), None = 5 (POST — review recommended):

- `blocks-release-api::auth::post-remove-authorization`
- `blocks-release-api::build::post-repo-update`
- `blocks-release-api::build::post-run-build`
- `blocks-release-api::build::post-manual`
- `blocks-release-api::build::post-repo-settings-update`

## Notes / caveats

- **Roles are intentionally empty** — the seed grants nothing. Attach roles
  via the mutation API.
- **Description is blank** at seed time; fill via `ResourceMutationService`.
- **POST/PUT verbs map to `None`** under the generic severity tables. Add a
  rule or override these to Medium/High before shipping.
- **No generator script committed** — only the JSON + this MD are produced.
