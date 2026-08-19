# Mannaah Phase 8 — Identity, Key Recovery & Sovereignty

Implemented on the Agora-derived source tree.

## Included

- Added `/identity` Mannaah Identity Centre.
- Shows the current public `npub` and its signer mode.
- Distinguishes local `nsec`, NIP-46 bunker, and external signer sessions.
- Routes local-key users to the existing Agora/Profile Settings backup controls.
- Explains that remote/external signers keep secret keys outside the Mannaah application.
- Adds a device-local recovery-plan acknowledgement.
- Explicitly separates Nostr identity recovery from Bitcoin/Lightning wallet recovery.
- Does not expose or publish secret keys.
- Does not implement a misleading automatic key-rotation/ownership-transfer feature; replacement keys create new identities and a future transfer protocol must define continuity.

## Security basis

NIP-46 is used by the underlying Agora implementation for remote signing. Its purpose is to keep the user's signing key with a remote signer while the client requests signatures. See the NIP-46 specification: https://github.com/nostr-protocol/nips/blob/master/46.md

## Validation

Full dependency installation/build remains an environment constraint. The source changes were applied to the Phase 7 tree; run `npm ci` followed by the project's normal test/build commands in a Node 22+ environment before deployment.
