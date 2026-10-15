# Shared app-kit package

`seliseblocks-app-kit-0.1.1.tgz` contains the shared `AppShell`, `AppTopbar`,
`AppSidebar`, and `WorkspaceSwitcher`, built from
[Blocks Console commit f6e016ba](https://github.com/SELISEdigitalplatforms/blocks-console/commit/f6e016ba).

This archive is checked in because version `0.1.1` is not yet available from npm.
The relative file dependency lets clean checkouts and Docker builds install the
same tested package. Docker copies the archive before running `npm ci`.

Once `0.1.1` is published, replace the file dependency by running
`npm install @seliseblocks/app-kit@^0.1.1` from `client/`, and remove the archive
and its Docker `COPY` instruction.
