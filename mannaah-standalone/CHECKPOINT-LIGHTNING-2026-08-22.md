# Mannaah Lightning Payment Checkpoint

## Status

Known-good staging checkpoint.

## Working

- Mannaah standalone HTML build exists.
- Payment service runs on port 8787.
- `/health` responds successfully.
- Wallet of Satoshi Lightning Address resolves successfully.
- LNURL-pay invoice creation works.
- Real Lightning invoice was successfully generated.
- QR code generation works.
- Payment registry creates a `paymentId`.
- New payments initially have `pending` status.
- `/api/payment/status/:paymentId` exists.
- Webhook endpoint exists but still requires verification hardening.

## Successful test

Campaign:
fatima

Amount:
25 sats

Payment ID:
pay_mt3sfzal_9eilc9n8

Destination:
fittingstretch95@walletofsatoshi.com

Result:
status = ready

## Important limitation

The current webhook must NOT be treated as production payment verification.

The next task is to harden the webhook and connect genuine Lightning settlement verification.

## Canonical build

Do not replace or rebuild the canonical Mannaah frontend while continuing payment work.

Current working directory:

/workspaces/Mannaah-/mannaah-standalone

## Next planned step

1. Harden webhook authentication.
2. Test unauthorized webhook rejection.
3. Test authenticated staging webhook.
4. Verify payment status transition.
5. Only then connect the frontend donor journey.
