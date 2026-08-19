# Phase 14 — Release Evidence & Security Gate

## Scope

This phase tightens the release candidate rather than adding product features.

### Changes

- Production SSH deployment now requires the protected `DEPLOY_KNOWN_HOSTS` CI/CD variable. Runtime `ssh-keyscan` trust-on-first-use has been removed.
- Added `security:static`, a repository scan for private-key material, extended private-key formats, mnemonic/seed declarations, and obvious hard-coded secret assignments.
- The release gate now runs the static security scan before the build/test stages.

## Evidence status

The static security scan and release-readiness checks can run without installing dependencies.

A complete clean-install build still requires network access to the npm registry and the configured CI/CD environment. This environment could not complete `npm audit` because registry DNS/network access was unavailable; therefore no vulnerability-free dependency claim is made here.

## Mainnet rule

Mannaah remains **NO-GO for real fundraising** until the release evidence includes:

1. clean `npm ci`;
2. typecheck/lint/unit-test/build results;
3. Bitcoin payment reconciliation evidence;
4. Lightning settlement evidence;
5. signer recovery drill;
6. privacy/publication review;
7. backup/restore drill;
8. dependency vulnerability assessment;
9. staging E2E evidence; and
10. production deployment verification.

This follows the lifecycle-oriented approach of NIST SP 800-218 SSDF 1.1, which organizes secure development around preparing the organization, protecting software, producing well-secured software, and responding to vulnerabilities.
