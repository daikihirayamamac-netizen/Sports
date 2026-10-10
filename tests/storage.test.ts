import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {initialBoard,applyAction} from '../src/lib/match';
import {compareAndSet,readBoard,rateLimit,localMode} from '../src/lib/storage';
import {randomUUID} from 'node:crypto';

test('competing writes cannot silently overwrite one another; data survives reloads',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'sports-test-'));
  process.env.LOCAL_DEMO='1';process.env.LOCAL_DATA_DIR=dir;
  try{
    const first=applyAction(initialBoard(),'match-1300',{type:'note',text:'first'},randomUUID(),1000);
    const second=applyAction(initialBoard(),'match-1300',{type:'note',text:'second'},randomUUID(),1000);
    const results=await Promise.all([compareAndSet(0,first),compareAndSet(0,second)]);
    assert.equal(results.filter(Boolean).length,1);
    const persisted=await readBoard();assert.equal(persisted.version,1);assert.equal(persisted.matches[0].events.length,1);
    assert.deepEqual(await readBoard(),persisted);
    assert.equal(await rateLimit('test',2,60),true);assert.equal(await rateLimit('test',2,60),true);assert.equal(await rateLimit('test',2,60),false);
    process.env.VERCEL='1';assert.equal(localMode(),false);delete process.env.VERCEL;
  }finally{delete process.env.LOCAL_DEMO;delete process.env.LOCAL_DATA_DIR;await rm(dir,{recursive:true,force:true});}
});
