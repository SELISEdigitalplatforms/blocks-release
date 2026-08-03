# Contributing to Blocks Release

Thank you for your interest in contributing to **Blocks Release**. Contributions of all kinds are welcome: bug reports, feature suggestions, documentation, and code. This guide describes how this repository is organized and the process to get a change merged.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Reporting Issues](#reporting-issues)
- [Reporting a Security Issue](#reporting-a-security-issue)
- [Branching Model](#branching-model)
- [Commit Conventions](#commit-conventions)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Test Gates](#test-gates)
- [Code Review Process](#code-review-process)
- [License](#license)

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.

## Reporting Issues

If you encounter a bug or want to request an enhancement, open an issue and include:

- **Description**: a clear and concise description of the problem or request.
- **Steps to Reproduce**: the steps that trigger the behavior.
- **Expected Behavior**: what you expected to happen.
- **Actual Behavior**: what actually happened.
- **Environment**: OS, browser, .NET SDK and Node.js versions where relevant.
- **Logs or screenshots**: anything that helps diagnose the issue.

## Reporting a Security Issue

Do not open a public issue for security vulnerabilities. Follow the private disclosure process described in [SECURITY.md](./SECURITY.md).

## Branching Model

This repository uses two long-lived branches and no personal feature branches:

- `main`: production-ready code. Protected.
- `dev`: integration branch for the next release. Protected.
- `inception`: the active working branch where changes land first.

The flow is:

1. Make your changes on `inception`.
2. Open a pull request from `inception` into `dev`.
3. After review and green checks, the change is merged into `dev`.
4. `dev` is promoted to `main` through the release process.

Do not commit directly to `dev` or `main`; both are protected. Do not force-push or rewrite history on any shared branch.

## Commit Conventions

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) style, matching the existing history in this repository:

- Format: `type(scope): short summary`.
- Common types: `feat`, `fix`, `docs`, `test`, `build`, `refactor`, `style`, `chore`.
- Common scopes seen here: `client`, `server`, `e2e`.
- Keep the subject in the imperative mood, lowercase, and without a trailing period.
- Add a body (after a blank line) when you need to explain the what and why.

Examples drawn from this repository's log:

```
test(client): cover repo-details custom url, mobile tab select, and settings-modal deploy branches
build(server): bump Swashbuckle.AspNetCore to 10.2.3 and pin Swagger stack in Devops.DomainService
```

A pre-commit hook (`.husky/pre-commit`) runs lint-staged on staged `client` files, and a pre-push hook (`.husky/pre-push`) builds the server and the client before pushing. Keep both green rather than bypassing them.

## Submitting Pull Requests

1. Ensure your branch is `inception` and is up to date with the remote.
2. Run the [test gates](#test-gates) locally and confirm they pass.
3. Update documentation affected by your change:
   - `README.md` when behavior, setup, or usage changes.
   - Nested docs such as `e2e/README.md` when the area they describe changes.
4. Open a pull request with base `dev` and head `inception`.
5. Describe what changed, why, and how you verified it. Reference related issues (for example, `fixes #123`).

## Test Gates

Run these from the repository root. They must pass before a change is merged.

| Suite | Command |
| --- | --- |
| Backend unit (.NET) | `dotnet test server/XUnitTest/XUnitTest.csproj` |
| Frontend unit (Vitest) | `npm --prefix client run test` |
| End-to-end (Playwright) | `npm --prefix e2e run test` |
| Security scan (SAST, SCA, secrets) | `bash scripts/scan.sh` |

Notes:

- There is no `.sln` in this repository. Target the `.csproj` directly for backend tests.
- The e2e suite drives a running application and needs `e2e/.env.e2e` configured. See [e2e/README.md](./e2e/README.md) for setup and target-host options.
- Do not disable rules, delete tests, lower thresholds, or add suppressions to make a gate pass. Fix the underlying issue, or record a written justification for a confirmed false positive.

## Code Review Process

1. **PR submission**: keep pull requests small and well described.
2. **Automated checks**: CI runs tests and scans on the pull request.
3. **Peer review**: at least one maintainer must approve.
4. **Merge**: once approved and green, the PR is merged into `dev`.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
