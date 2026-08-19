import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(), out=path.join(root,'release-evidence','manual');
fs.mkdirSync(out,{recursive:true});
const names=['BITCOIN_RECONCILIATION','LIGHTNING_SETTLEMENT','SIGNER_RECOVERY','PRIVACY_REVIEW','BACKUP_RESTORE','STAGING_E2E','PRODUCTION_DEPLOYMENT'];
const pack={schema_version:1,generated_at:new Date().toISOString(),evidence:names.map(name=>({name,status:'NOT_RUN',executed_at:null,operator:null,environment:null,artifact:null,notes:''}))};
const file=path.join(out,'evidence-pack.json'); fs.writeFileSync(file,JSON.stringify(pack,null,2)+'\n');
const sha=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); fs.writeFileSync(path.join(out,'evidence-pack.sha256'),`${sha}  evidence-pack.json\n`); console.log(`Created ${path.relative(root,file)}`);
