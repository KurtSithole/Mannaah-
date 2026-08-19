# Mannaah Mainnet Readiness Matrix

| Area | Required evidence | Status |
|---|---|---|
| Clean install | `npm ci` completes reproducibly | BLOCKED until CI run |
| TypeScript | `npm run typecheck` passes | BLOCKED until CI run |
| Lint | `npm run lint` passes | BLOCKED until CI run |
| Unit tests | `npm run test:unit` passes | BLOCKED until CI run |
| Production build | `npm run build` passes | BLOCKED until CI run |
| Nostr signing | Independent signer tests | REQUIRED |
| Relay resilience | outage/retry/duplicate tests | REQUIRED |
| Bitcoin accounting | authoritative transaction tests | REQUIRED |
| Lightning settlement | authoritative invoice/payment tests | REQUIRED |
| Privacy | public/private data review | REQUIRED |
| Key recovery | lost-device and compromised-key drill | REQUIRED |
| Deployment | staged artifact promotion | REQUIRED |
| Observability | errors, health, alerts | REQUIRED |
| Backup/restore | documented and exercised | REQUIRED |
| Incident response | runbook and owner | REQUIRED |

A green application build is necessary but not sufficient for mainnet fundraising. This matrix follows the risk-based secure-development approach recommended by NIST SSDF: security activities are integrated across preparation, protection, secure production and vulnerability response rather than treated as a single final checklist. See NIST SP 800-218.
