import test from 'node:test'
import assert from 'node:assert/strict'
import {indexedDB} from 'fake-indexeddb'
import {AIStore} from '../src/ai/store.ts'
Object.assign(globalThis,{indexedDB})
test('v1 to v2 upgrade preserves old histories/identities and does not assign them to a lecture',async()=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('aoyamahack-web-ai-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('messages',{keyPath:'id'});r.result.createObjectStore('materials',{keyPath:'id'});r.result.createObjectStore('identities')};r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result)})
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['messages','identities'],'readwrite');tx.objectStore('messages').put({id:'old',uid:'synthetic-upgrade-owner',courseKey:'old-course',text:'以前の混在履歴',role:'user',state:'done',sourceIds:[],createdAt:1});tx.objectStore('identities').put('old-local-uuid',JSON.stringify(['synthetic-upgrade-owner','#####']));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})
 db.close();const store=new AIStore();assert.equal((await store.messages('synthetic-upgrade-owner','old-course')).length,1);assert.equal((await store.messages('synthetic-upgrade-owner','old-course','new-thread')).length,0);assert.equal(await store.lookupIdentity('synthetic-upgrade-owner','#####'),'old-local-uuid')
 await store.putSettings('synthetic-upgrade-owner','course',{firstDate:'2026-09-15'});assert.equal((await store.settings('synthetic-upgrade-owner','course'))!.firstDate,'2026-09-15');assert.equal(await store.settings('another-owner','course'),undefined)
})
