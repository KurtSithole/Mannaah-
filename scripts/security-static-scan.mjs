import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set(['node_modules', '.git', 'dist', 'coverage', 'android/.gradle']);
const findings = [];

// Scan for actual secret material, not merely references to secret-handling code.
const literalPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:xprv|tprv|zprv|yprv)[1-9A-HJ-NP-Za-km-z]{40,}\b/,
  /\b(?:nsec1)[023456789acdefghjklmnpqrstuvwxyz]{58}\b/,
  /\b(?:mnemonic|seed phrase)\s*[:=]\s*["'][^"']{40,}["']/i,
];

const configFiles = new Set(['.env', '.env.production', '.env.staging', '.npmrc', 'Dockerfile', 'docker-compose.prod.yml']);
const secretAssignment = /^(?:\s*(?:export\s+)?)?(?:[A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY|MNEMONIC|SEED)[A-Z0-9_]*)\s*=\s*["']?[^#\s"']{16,}/i;

function shouldIgnore(rel) {
  return [...ignoredDirs].some(d => rel === d || rel.startsWith(`${d}/`));
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll('\\', '/');
    if (entry.isDirectory()) { if (!shouldIgnore(rel)) walk(full); continue; }
    if (/\.(png|jpg|jpeg|gif|webp|ico|zip|pdf|woff2?|ttf|eot)$/i.test(entry.name)) continue;
    let text;
    try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
    const lines = text.split(/\r?\n/);
    for (const [i, line] of lines.entries()) {
      for (const pattern of literalPatterns) {
        if (pattern.test(line)) findings.push(`${rel}:${i + 1}: literal secret material pattern`);
      }
      if (configFiles.has(entry.name) && secretAssignment.test(line) && !/^(?:\s*#|\s*[A-Z0-9_]+\s*=\s*["']?\$\{|\s*[A-Z0-9_]+\s*=\s*["']?\*{4,})/i.test(line)) {
        findings.push(`${rel}:${i + 1}: hard-coded secret-like configuration value`);
      }
    }
  }
}
walk(root);

if (findings.length) {
  console.error('Static security scan: FAIL');
  findings.slice(0, 100).forEach(f => console.error(`- ${f}`));
  process.exit(1);
}
console.log('Static security scan: PASS');
