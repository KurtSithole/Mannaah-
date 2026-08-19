# Mannaah Phase 3 — Donor & Payment Experience

Implemented directly on the Agora-derived source tree.

## Changes
- Added optional `amountSats` support to `CampaignWalletDonatePanel`.
- BIP-21 payment URIs can now carry a preselected BTC amount while preserving on-chain and silent-payment endpoints.
- Donation QR/copy/open-wallet paths preserve the selected amount when supplied.
- Clarified the donation message field as a public Nostr message and warned donors that adding it publishes it in the signed kind 8333 receipt.
- Added an explicit non-custodial reassurance to the in-app donation form.
- Preserved Agora's existing Bitcoin PSBT signing, broadcast, receipt publication, fee selection and campaign accounting machinery.

## Safety / protocol note
A Nostr donation receipt is signed by the donor identity. Leaving the comment blank does not make the transaction itself anonymous. The external-wallet path remains available for donors who prefer not to publish a Nostr receipt.

## Validation
A clean dependency installation could not be completed in this execution environment, so a full TypeScript/Vite production build has not been claimed.
