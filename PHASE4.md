# Mannaah Phase 4 — Post-donation & Support Mannaah

Implemented on top of the actual Agora-derived source tree.

## Included

- Post-donation confirmation now offers a direct **Support Mannaah** path.
- New `/support-mannaah` page with:
  - preset donation amounts
  - custom amount input
  - BIP-21 Bitcoin URI when a support address is configured
  - QR code and copy/open-wallet actions
  - explicit no-custody/no-fake-treasury behavior when unconfigured
  - frictionless native sharing with clipboard fallback
  - return to campaign discovery
- Existing campaign donation transaction flow and kind 8333 receipts remain unchanged.

## Configuration

Set `VITE_MANNAH_SUPPORT_BTC_ADDRESS` at deployment time to enable the Mannaah support payment QR and wallet hand-off.

## Validation

Source-level validation was performed. A clean production build still requires dependency installation in a normal Node environment because the execution environment has not been able to complete Agora's dependency installation reliably.
