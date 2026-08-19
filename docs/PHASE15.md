# Phase 15 — Staging Evidence Automation & Mainnet Gate

## Purpose

Phase 15 moves Mannaah from release documentation toward reproducible release evidence. It does not claim that payment, identity-recovery, privacy, or staging tests have passed unless those tests are actually executed.

## Added

- `scripts/collect-release-evidence.mjs` creates a timestamped release evidence manifest with repository checks and SHA-256 hashes of key release files.
- `scripts/mainnet-gate.mjs` provides an explicit GO/NO-GO gate based on declared evidence variables.
- `npm run evidence:collect` creates `release-evidence/manifest.json`.
- `npm run mainnet:gate` refuses a release unless every required evidence category is explicitly marked `PASS`.

## Required evidence categories

- CLEAN_INSTALL
- TYPECHECK
- LINT
- UNIT_TESTS
- PRODUCTION_BUILD
- BITCOIN_RECONCILIATION
- LIGHTNING_SETTLEMENT
- SIGNER_RECOVERY
- PRIVACY_REVIEW
- BACKUP_RESTORE
- STAGING_E2E
- PRODUCTION_DEPLOYMENT

## Security principle

The gate is intentionally fail-closed. Missing evidence is not interpreted as success. This is consistent with the outcome-oriented security lifecycle described by NIST SP 800-218 SSDF 1.1.

## Important limitation

A generated evidence manifest is evidence of repository/configuration checks only. It must not be used as a substitute for executing the real staging and payment drills.
