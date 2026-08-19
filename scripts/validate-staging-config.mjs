const required = ['VITE_MANNAH_STAGING'];
const env = process.env;
const errors = [];
if (env.VITE_MANNAH_STAGING !== 'true') errors.push('VITE_MANNAH_STAGING=true is required for staging tests.');
const relays = (env.VITE_MANNAH_RELAYS || '').split(',').map(s=>s.trim()).filter(Boolean);
for (const relay of relays) {
  if (!/^wss?:\/\//.test(relay)) errors.push(`Invalid relay URL: ${relay}`);
}
for (const [k,v] of Object.entries(env)) {
  if (/^VITE_/i.test(k) && /(PRIVATE|SECRET|PASSWORD|TOKEN|SEED|MNEMONIC|NSEC|API_KEY)/i.test(k)) errors.push(`Potential secret in public Vite variable: ${k}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Mannaah staging configuration valid (${relays.length} dedicated relays).`);
