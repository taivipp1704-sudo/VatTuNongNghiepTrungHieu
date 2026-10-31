import { Pool } from 'pg';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backup, restore } from './backup.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(readFileSync(path.join(root,'.local/postgres.json'),'utf8'));
const base=`postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/`;
const admin=new Pool({connectionString:base+'postgres'});
const source=new Pool({connectionString:base+'agristock_test'});
const name='agristock_restore_'+Date.now();
await admin.query('CREATE DATABASE '+name);
const target=new Pool({connectionString:base+name});
try{
  await target.query(readFileSync(path.join(root,'apps/api/schema.sql'),'utf8'));
  const directory=path.join(root,'.local/backups');mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'restore-validation.json.gz');
  const snapshot=await backup(source,file);
  await restore(target,file);
  for(const [table,rows] of Object.entries(snapshot.tables)){
    const count=(await target.query('SELECT COUNT(*)::int count FROM '+table)).rows[0].count;
    assert.equal(count,rows.length,table+' row count');
  }
  const sourceLots=(await source.query('SELECT id,expires_on,quantity::text,reserved::text FROM lots ORDER BY id')).rows;
  const targetLots=(await target.query('SELECT id,expires_on,quantity::text,reserved::text FROM lots ORDER BY id')).rows;
  assert.deepEqual(sourceLots,targetLots);
  for(const sql of [
    "SELECT id,kind,data,created_by,created_at,product_id,order_id,note FROM photos ORDER BY id",
    'SELECT customer_id,balance::text FROM loyalty_accounts ORDER BY customer_id',
    'SELECT id,delta::text,balance::text,source_key FROM loyalty_ledger ORDER BY id',
    'SELECT id,loyalty_snapshot,loyalty_earned::text,loyalty_spent::text,loyalty_discount::text FROM orders ORDER BY id',
  ]) assert.deepEqual((await source.query(sql)).rows,(await target.query(sql)).rows);
  await assert.rejects(()=>restore(target,file),/trống/);
  assert.equal((await target.query('SELECT COUNT(*)::int count FROM sessions')).rows[0].count,0);
  console.log('PASS: backup/restore round trip, all table counts, quantities, dates, empty-target guard, sessions excluded.');
}finally{
  await target.end();await source.end();
  await admin.query('DROP DATABASE '+name);await admin.end();
}
