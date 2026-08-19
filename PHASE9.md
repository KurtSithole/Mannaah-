# Mannaah Phase 9 — Production Infrastructure & Resilience

## Implemented
- Dedicated Mannaah relay configuration via `VITE_MANNAH_RELAYS`.
- Relay health probes with timeout/latency reporting.
- A private local retry queue for failed **public** event publication payloads.
- Queue bounded to the latest 25 items and explicitly prohibited from storing private keys, wallet seeds, or payment credentials.
- `/network` diagnostics page for relay health and queued publication visibility.
- Existing Agora relay/pooling infrastructure remains the underlying transport.

## Protocol rationale
Nostr events are signed objects and relay publication is separate from event creation. Mannaah therefore treats relay availability as a transport concern rather than an identity concern. A failed relay must not imply a failed identity or campaign. See NIP-01 and NIP-46 for the protocol boundaries used by this architecture.

## Production follow-up
- Wire the retry queue into the actual Mannaah campaign publisher after signer abstraction is finalized.
- Add exponential backoff with jitter and maximum retry age.
- Add relay receipt/acknowledgement telemetry.
- Configure at least three independently operated relays before production.
- Add authenticated private storage for any private drafts; do not put private campaign verification material into public Nostr events.
- Run full dependency installation, TypeScript, ESLint, Vitest and Vite production build in CI.
- Add end-to-end tests for relay outage, partial publication, signer failure and payment reconciliation.
