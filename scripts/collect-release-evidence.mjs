import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outDir = path.join(root, 'release-evidence');
fs.mkdirSync(outDir, { recursive: true });

const checks = [];
const check = (name, status, details = '') => checks.push({ name, status, details });

const required = [
  'package.json', 'package-lock.json', '.gitlab-ci.yml', 'Dockerfile',
  'nginx.conf', 'docs/MAINNET_READINESS_MATRIX.md', 'docs/STAGING_RUNBOOK.md'
];
for (const file of required) {
  check(`required:${file}`, fs.existsSync(path.join(root, file)) ? 'PASS' : 'FAIL');
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
check('node-engine', pkg.engines?.node ? 'PASS' : 'FAIL', pkg.engines?.node ?? 'missing');
check('lockfile-v3+', Number(lock.lockfileVersion) >= 3 ? 'PASS' : 'FAIL', String(lock.lockfileVersion));
check('static-security-script', typeof pkg.scripts?.['security:static'] === 'string' ? 'PASS' : 'FAIL');
check('release-gate-script', typeof pkg.scripts?.['release:gate'] === 'string' ? 'PASS' : 'FAIL');

const envKeys = Object.keys(process.env).filter(k => k.startsWith('VITE_'));
const suspicious = envKeys.filter(k => /(PRIVATE|SECRET|PASSWORD|SEED|MNEMONIC|NSEC|TOKEN|API_KEY)/i.test(k));
check('public-config-secret-scan', suspicious.length === 0 ? 'PASS' : 'FAIL', suspicious.join(', '));

const files = ['package.json', 'package-lock.json', '.gitlab-ci.yml'];
const hashes = Object.fromEntries(files.filter(f => fs.existsSync(path.join(root, f))).map(f => {
  const data = fs.readFileSync(path.join(root, f));
  return [f, crypto.createHash('sha256').update(data).digest('hex')];
}));

const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  environment: process.env.CI ? 'ci' : 'local',
  checks,
  hashes,
  note: 'This manifest records evidence available to the execution environment. It does not assert successful payment, signer-recovery, privacy, or staging E2E tests unless those tests have actually been executed.'
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
const failed = checks.filter(c => c.status === 'FAIL');
console.log(`Release evidence manifest written to ${path.relative(root, path.join(outDir, 'manifest.json'))}`);
console.log(`Checks: ${checks.length}; failures: ${failed.length}`);
if (failed.length) process.exit(1);
