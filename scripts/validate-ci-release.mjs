#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const required = [
  '.gitlab-ci.yml',
  'package-lock.json',
  'scripts/mainnet-gate.mjs',
  'scripts/collect-release-evidence.mjs',
  'scripts/security-static-scan.mjs',
  'scripts/validate-staging-config.mjs',
  'docs/STAGING_RUNBOOK.md',
];

const missing = required.filter((file) => !fs.existsSync(path.resolve(file)));
if (missing.length) {
  console.error('CI release validation failed:');
  for (const file of missing) console.error(`- missing ${file}`);
  process.exit(1);
}

const ci = fs.readFileSync('.gitlab-ci.yml', 'utf8');
const requiredSnippets = [
  'npm ci',
  'npm run typecheck',
  'npm run lint',
  'npm run test:unit',
  'npm run build',
  'DEPLOY_KNOWN_HOSTS',
];
const missingSnippets = requiredSnippets.filter((snippet) => !ci.includes(snippet));
if (missingSnippets.length) {
  console.error('CI release validation failed: missing required pipeline controls');
  for (const snippet of missingSnippets) console.error(`- ${snippet}`);
  process.exit(1);
}

console.log('CI release validation: PASS');
