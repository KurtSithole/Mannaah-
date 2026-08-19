# Mannaah Phase 2C — Trust & Safety

This increment adds a Mannaah-specific trust surface to the Agora campaign detail experience.

## Principles

- Separate cryptographically verifiable facts from human claims.
- Do not turn a community verification into a blanket endorsement.
- Do not claim Mannaah has investigated a campaign unless a dedicated review signal exists.
- Keep the existing Agora/Nostr campaign and verification protocols underneath the Mannaah UX.

## Added

- `src/components/MannaahTrustPanel.tsx`
- Trust panel integration in `CampaignDetailPage.tsx`

## Signals shown

1. Payment destination format recognised by the campaign protocol.
2. Cryptographic Nostr authorship/control of the campaign event.
3. Community verification labels and the existing verifier badge.
4. Explicit distinction between community verification and Mannaah review.
5. Public campaign history / signed creation event.

## Validation

The repository was modified directly from the uploaded Agora source tree. A complete dependency installation and production build still needs to be run in a normal development environment because the execution environment used for this build cannot reliably complete the repository's dependency installation.
