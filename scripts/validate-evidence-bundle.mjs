import fs from 'node:fs'; import path from 'node:path';
const dir=path.join(process.cwd(),'release-evidence','manual');
const required=['BITCOIN_RECONCILIATION','LIGHTNING_SETTLEMENT','SIGNER_RECOVERY','PRIVACY_REVIEW','BACKUP_RESTORE','STAGING_E2E','PRODUCTION_DEPLOYMENT'];
if(!fs.existsSync(dir)){console.log('Evidence bundle: NO-GO — directory missing.');process.exit(2)}
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='evidence.template.json'); if(!files.length){console.log('Evidence bundle: NOT READY — no executed evidence records found.');process.exit(2)}
const seen=new Map(); for(const file of files){let data; try{data=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'))}catch{console.error(`Invalid evidence JSON: ${file}`);process.exit(1)} for(const item of (data.evidence||[])) if(required.includes(item.name)) seen.set(item.name,item)}
const missing=required.filter(n=>!seen.has(n)||seen.get(n).status!=='PASS'); if(missing.length){console.log(`Evidence bundle: NO-GO — missing/unpassed: ${missing.join(', ')}`);process.exit(2)} console.log('Evidence bundle: PASS — all required operational evidence records are present.');
