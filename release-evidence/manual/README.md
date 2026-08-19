# Manual operational evidence

Populate `evidence-pack.json` only from real staging/production test runs. Do not mark an item PASS based on configuration alone.

Required fields for each PASS record:

- `name`
- `status: PASS`
- `executed_at`
- `operator`
- `environment`
- `artifact`
- `notes`

Keep sensitive credentials, private keys, wallet seeds and personal data out of evidence artifacts.
