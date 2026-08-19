import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const evidence = path.join(root, 'release-evidence', 'manifest.json');
if (!fs.existsSync(evidence)) {
  console.error('MAINNET GATE: FAIL — release-evidence/manifest.json is missing.');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(evidence, 'utf8'));
const failures = report.checks.filter(c => c.status !== 'PASS');
const requiredEvidence = [
  'CLEAN_INSTALL', 'TYPECHECK', 'LINT', 'UNIT_TESTS', 'PRODUCTION_BUILD',
  'BITCOIN_RECONCILIATION', 'LIGHTNING_SETTLEMENT', 'SIGNER_RECOVERY',
  'PRIVACY_REVIEW', 'BACKUP_RESTORE', 'STAGING_E2E', 'PRODUCTION_DEPLOYMENT'
];

const missing = requiredEvidence.filter(name => process.env[`EVIDENCE_${name}`] !== 'PASS');
if (failures.length || missing.length) {
  console.error('MAINNET GATE: NO-GO');
  if (failures.length) console.error(`Static failures: ${failures.length}`);
  if (missing.length) console.error(`Missing evidence: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('MAINNET GATE: GO — all declared evidence gates passed.');
