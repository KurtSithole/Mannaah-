import fs from "node:fs";
import path from "node:path";
const root=process.cwd(), fail=[];
for(const f of ["package.json","package-lock.json","vite.config.ts","tsconfig.json","Dockerfile","nginx.conf",".gitlab-ci.yml","docs/MAINNET_READINESS_MATRIX.md"]) if(!fs.existsSync(path.join(root,f))) fail.push(`Missing ${f}`);
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
if(!pkg.engines?.node) fail.push("Node engine is not declared");
const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));
if(Number(lock.lockfileVersion)<3) fail.push(`Unsupported lockfileVersion ${lock.lockfileVersion}`);
for(const f of [".env.example",".env.staging.example"]){const p=path.join(root,f);if(!fs.existsSync(p))continue;for(const line of fs.readFileSync(p,"utf8").split(/\r?\n/)){const m=line.match(/^\\s*(VITE_[A-Z0-9_]+)\\s*=/);if(m&&/(PRIVATE|SECRET|PASSWORD|SEED|MNEMONIC|TOKEN|API_KEY)/i.test(m[1]))fail.push(`${f}: suspicious public secret variable ${m[1]}`)}}
console.log(`Release candidate static gate: ${fail.length?"FAIL":"PASS"}`);for(const x of fail)console.error(`- ${x}`);process.exit(fail.length?1:0);
