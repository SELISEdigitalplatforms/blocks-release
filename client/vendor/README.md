# Shared app-kit package

`seliseblocks-app-kit-0.1.1.tgz` contains the shared `AppShell`, `AppTopbar`,
`AppSidebar`, and `WorkspaceSwitcher`, built from
[Blocks Console commit f6e016ba](https://github.com/SELISEdigitalplatforms/blocks-console/commit/f6e016ba).

Release applies `app-kit-console-ui.patch` to that source commit before building
this archive. It brings Console's breadcrumb top bar, overview hero, metadata,
Bootstrap dialog, and Domains/Repositories tables into the shared package.
The command palette's shared commands (View Console, View Profile and the light / dark /
system theme switches) also come from the package: `SHARED_COMMANDS`,
`resolveSharedCommands` and `useThemePaletteActions`.
`DashboardOverview` takes `showDomains` and `showRepositories` (both default to
`true`); Release's `/dashboard` route passes `false` for both.
Release's Core APIs components and Swagger hook remain unchanged. The package
build targets browsers so Bootstrap's Markdown dependencies use browser entry
points.

The relative dependency lets local development and Docker install the same
package without publishing to npm. Docker copies the archive before `npm ci`.

To rebuild, check out the linked Console commit in a separate directory, run
`npm ci` in its `client/`, and apply this patch from the Console repository root:

```sh
git apply --directory=client/vendor/app-kit /path/to/blocks-release/client/vendor/app-kit-console-ui.patch
cd client/vendor/app-kit
../../node_modules/.bin/tsup
npm pack --ignore-scripts
```

Copy the resulting archive here and refresh its lockfile integrity before
running `npm ci` in Release's `client/`. During iteration, build locally and
copy `dist/` into Release's installed app-kit; pack only the final artifact.
No npm publication is required.
