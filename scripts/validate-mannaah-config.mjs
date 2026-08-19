const relayValue = process.env.VITE_MANNAH_RELAYS ?? '';
const relays = relayValue.split(',').map((value) => value.trim()).filter(Boolean);

for (const relay of relays) {
  let parsed;
  try {
    parsed = new URL(relay);
  } catch {
    throw new Error(`Invalid VITE_MANNAH_RELAYS entry: ${relay}`);
  }
  if (!['ws:', 'wss:'].includes(parsed.protocol)) {
    throw new Error(`Mannaah relay must use ws:// or wss://: ${relay}`);
  }
}

for (const [key, value] of Object.entries(process.env)) {
  if (!key.startsWith('VITE_') || value == null) continue;
  if (/SECRET|PRIVATE|PASSWORD|SEED|TOKEN|API_KEY|KEY$/i.test(key)) {
    throw new Error(`Refusing to expose a likely secret through Vite public configuration: ${key}`);
  }
}

console.log(`Mannaah public configuration valid (${relays.length} dedicated relay${relays.length === 1 ? '' : 's'} configured).`);
