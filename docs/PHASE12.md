# Phase 12 — Staging, E2E Testing & Mainnet Readiness

Implemented a release-gate layer for Mannaah.

## Added

- staging-only configuration template;
- public Vite configuration validation;
- staging validation command;
- combined `staging:gate` command;
- staging deployment/runbook;
- end-to-end smoke journey covering recipient, donor, payment, lifecycle and resilience flows;
- explicit mainnet readiness matrix.

## Safety boundary

Staging must never use production wallets, real recipient funds, real private keys, or production relay infrastructure.

## Current release posture

NO-GO until a clean CI environment completes the full staging gate and the payment, signer recovery and privacy drills have passed.
