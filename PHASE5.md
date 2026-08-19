# Mannaah Phase 5 — Lightning Foundation

This increment adds an optional Lightning destination to Mannaah campaigns while preserving Agora's existing on-chain accounting and kind 33863 campaign protocol.

## Added
- Optional `l` campaign tag for a Lightning Address, bech32 LNURL-pay value, or HTTPS LNURL-pay endpoint.
- Creator UI for declaring a Lightning destination.
- Donor UI for copying/sharing the Lightning destination.
- Explicit disclosure that externally settled Lightning payments are not yet included in Mannaah's verified campaign total.

## Deliberate boundary
This phase does **not** invent an invoice resolver, custodial Lightning service, or fake payment-confirmation path. The destination is controlled by the campaign creator and the donor's wallet performs the Lightning payment.

The next Lightning increment should add a real LNURL-pay/WebLN or external-wallet payment path and a verifiable receipt/accounting model before Lightning payments are counted toward campaign progress.
