# Mannaah Phase 7 — Notifications & Relationship Layer

This increment adds a Mannaah-specific, privacy-first relationship layer on top of Agora.

## Implemented

- Private local campaign follows using `localStorage`.
- Follow/unfollow control on campaign detail pages.
- `/my-help` page for campaigns followed on the current device.
- Explicit privacy copy: follows do not create a public follower graph.
- Link from campaign detail to My Help.

## Deliberate scope boundary

This increment does not publish follow events to Nostr. That is intentional: Mannaah's default relationship model is private. Existing Agora notifications remain available for public Nostr interactions, but campaign follows do not automatically subscribe donors to a public social graph.

## Next work

Production donor receipt indexing can extend My Help to show supported campaigns, while a future notification adapter can offer opt-in campaign update alerts without exposing follower identities.
