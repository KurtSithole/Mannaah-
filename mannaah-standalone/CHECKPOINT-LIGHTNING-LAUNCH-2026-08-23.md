# Mannaah Lightning Launch Checkpoint — 2026-08-23

## Validated

- Frontend listening on port 8090
- Payment service listening on port 8787
- Frontend HTTP response: 200
- Payment service health: OK
- Lightning Address resolution: working
- Real Lightning invoice generation: working
- Lightning QR generation: working
- Lightning QR rendering in Mannaah: working
- Payment record creation: working
- Newly created payments remain pending until independently verified
- Campaign accounting does not increase merely from invoice creation
- Fatima campaign baseline restored to 650 sats
- Payment service restarted from canonical source
- No automatic settlement verification is configured

## Known limitations

- PAYMENT_WEBHOOK_SECRET is not configured.
- Automatic independent Lightning settlement verification is not active.
- Campaign accounting is in-memory and is not persistent production storage.
- The current Lightning destination is a development/test destination and must not be treated as a production campaign configuration.

## Freeze rule

Do not modify the validated Lightning payment flow without a new checkpoint and regression test.
