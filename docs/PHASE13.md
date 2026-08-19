# Phase 13 — Release Candidate & Operational Readiness

This phase establishes the final release-candidate gate before mainnet fundraising.

## Gate

1. Clean npm ci in CI
2. Typecheck
3. Lint
4. Unit tests
5. Production build
6. Static secret/config scan
7. Staging end-to-end smoke tests
8. Bitcoin payment reconciliation tests
9. Lightning settlement tests
10. Nostr signer recovery drill
11. Privacy/publication review
12. Backup/restore drill

## Release rule

No real fundraising until all P0/P1 gates have recorded evidence. A green frontend build alone is insufficient.

NIST SSDF is used as a lifecycle security reference; the current NIST site lists SP 800-218 v1.1 as final and v1.2 as a 2025 draft.
