# Phase 16 — Staging Execution Gate

## Objective

Phase 16 moves the project from generated release evidence toward **executed staging evidence**. It adds a manual GitLab staging gate that performs a clean dependency install, security/static checks, release evidence collection, and a live HTTPS health check against the deployed staging environment.

## Added

- `scripts/validate-ci-release.mjs` verifies that the CI pipeline contains the mandatory clean-install, typecheck, lint, unit-test, build, and SSH host-key controls.
- `npm run security:audit` provides a high-severity production-dependency audit command. It requires registry access and is intentionally not treated as passed unless CI executes it successfully.
- `npm run ci:release-evidence` validates the CI controls and creates the release evidence manifest.
- `staging-evidence` GitLab CI job. It is manual, fail-closed, requires `STAGING_URL`, requires HTTPS, checks `/health`, and publishes the evidence manifest as an artifact.

## What this phase does not claim

The presence of the staging job is **not** evidence that staging passed. A human/operator must run the manual job against a real staging deployment and retain the resulting CI artifact.

Payment reconciliation, Lightning settlement, signer recovery, privacy review, backup/restore, and full end-to-end flows remain separate evidence requirements in `mainnet:gate`.

## Release principle

NIST SSDF 1.1 is outcome-oriented. Phase 16 therefore distinguishes **configured controls** from **executed evidence**. A configured test is not a passed test.
