# Mannaah Phase 6 — Campaign Lifecycle & Impact

This phase adds a humanitarian campaign lifecycle on top of Agora's existing NIP-22 comment infrastructure.

## Included

- Recipient campaign updates.
- Explicit update states: progress, milestone, paused, completed.
- Public chronological update history on campaign detail pages.
- Signed Nostr publication through the existing `usePostComment` flow.
- `t=mannaah-update` marker for interoperability without inventing a new event kind.
- Clear notice that public Nostr updates can be replicated and may not be completely removable.
- Mannaah-specific visual treatment.

## Deliberate boundaries

- Updates do not change Bitcoin accounting.
- Completing a campaign does not automatically move or refund funds.
- Payment totals remain derived from Agora's existing accounting infrastructure.
- No private recipient information is published by this feature.
