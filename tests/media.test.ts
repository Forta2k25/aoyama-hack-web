import test from 'node:test'
import assert from 'node:assert/strict'
import {audioDurationSeconds} from '../src/ai/media.ts'

test('duration comes from the media container and always releases its object URL on success or invalid duration',async()=>{
 const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL
 let duration=8.04,released=0,cleared=0
 Object.assign(globalThis,{document:{createElement:()=>({duration,onloadedmetadata:null as null|(()=>void),onerror:null,set src(_value:string){queueMicrotask(()=>this.onloadedmetadata?.())},removeAttribute:()=>{cleared++},load:()=>{}})}})
 URL.createObjectURL=()=> 'blob:synthetic-media-test';URL.revokeObjectURL=()=>{released++}
 try{assert.equal(await audioDurationSeconds(new Blob(['same sized fixture'])),8.04);duration=Infinity;await assert.rejects(audioDurationSeconds(new Blob(['same sized fixture'])),/長さ/);assert.equal(released,2);assert.equal(cleared,2)}
 finally{URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document')}
})
