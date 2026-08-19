# Mannaah Phase 10 — Production Hardening & Release Engineering

## Implemented

- Removed implicit `npm install` side effects from `dev`, `build`, and `test` scripts.
- Added explicit `typecheck`, `lint`, and `test:unit` commands.
- Added unit coverage for the Mannaah relay configuration and publication retry queue.
- Added a CI quality gate that performs a clean `npm ci`, typecheck, lint, unit tests, and production build before deployment.
- Added production HTTP security headers to nginx, including HSTS, Referrer-Policy, Permissions-Policy, and a conservative Content-Security-Policy baseline.
- Added explicit no-cache behaviour for HTML and long-lived immutable caching for fingerprinted assets.
- Added deployment-time validation for required Mannaah public configuration values.

## Security boundaries

Mannaah's local publication retry queue stores only public unsigned event payloads. It must never store private keys, wallet seeds, authentication credentials, private verification documents, or payment secrets.

The browser build must treat all `VITE_*` values as public configuration. Secrets must remain in server-side/CI secret stores and must never be placed in Vite environment variables.

## Release gate

A release is not considered production-ready until CI completes:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run test:unit`
5. `npm run build`

The existing Android release job remains separate because it requires the Android SDK and signing credentials.
