# Mannaah Staging Runbook

## Purpose

Staging is the release gate between development and real fundraising. It must use non-production destinations, test identities and dedicated relays. Never use a real recipient wallet or real fundraising campaign in staging.

## Gate

Run on a clean checkout:

```bash
npm ci
npm run staging:gate
```

The gate must pass before a staging deployment is promoted.

## End-to-end smoke journey

1. Create a disposable Nostr identity/signer.
2. Create a campaign using a test recipient destination.
3. Run Privacy Preflight and confirm publication acknowledgement.
4. Publish to staging relays.
5. Verify the campaign can be rediscovered after a page reload.
6. Verify the campaign's signed event remains unchanged.
7. Open the donor journey.
8. Test amount selection and custom amount.
9. Test the Bitcoin payment URI/QR without sending real funds.
10. Test Lightning invoice handling against a controlled test environment when the settlement backend is enabled.
11. Confirm the campaign accounting path rejects duplicate payment records.
12. Publish a progress/milestone/completion update.
13. Follow the campaign privately and confirm it appears in My Help.
14. Simulate relay outage and verify publication retry behaviour.
15. Simulate browser restart and confirm no private key material is written to logs or public Nostr events.

## Promotion blockers

Do not promote if any of the following occurs:

- a staging test can publish a real payment destination accidentally;
- private keys/seeds appear in browser logs, telemetry, queued payloads or Nostr events;
- campaign totals can be inflated by duplicate payment events;
- a failed relay causes silent loss of a campaign publication;
- a campaign can be attributed to a donor when the donor chose a private flow;
- a Lightning payment can be displayed as settled without authoritative settlement evidence;
- the clean-install build fails.
