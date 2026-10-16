import test,{mock} from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {prepareImageUpload,isHEIC,imageFileAccept} from '../src/ai/image.ts'
import {fileKind} from '../src/ai/format.ts'
import {AIController} from '../src/ai/controller.ts'
import {AIStore} from '../src/ai/store.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import type {Receipt} from '../src/ai/types.ts'

const jpeg=()=>new Blob([new Uint8Array([255,216,255,224,1,2,3,4])],{type:'image/jpeg'})
let calls=0,decode:(input:any)=>Promise<Blob>=async()=>jpeg()
mock.module('heic-to/csp',{namedExports:{heicTo:(input:any)=>{calls++;assert.equal(input.type,'image/jpeg');assert.equal(input.quality,0.95);return decode(input)}}})
const heic=(name='PHOTO.HEIC',type='')=>new File(['\0\0\0\x18ftypheic\0\0\0\0heic'],name,{type})
const context={localCourseUUID:'synthetic-heic-course',classDocId:'00004',year:2026,dayID:20741,courseName:'架空授業',teacherName:'架空教員'}
async function until(check:()=>boolean){for(let i=0;i<200&&!check();i++)await new Promise(r=>setTimeout(r,5));assert(check(),'operation did not settle')}
class Backend extends DemoAIBackend{
  inputs:any[]=[];uploads:Blob[]=[];failUpload=false
  override async create(data:any):Promise<Receipt>{this.inputs.push(data);return {...await super.create(data),status:'awaiting_upload',upload:{url:'https://storage.googleapis.com/fixture'}}}
  override async retry(id:string):Promise<Receipt>{return {...await super.retry(id),status:'awaiting_upload',upload:{url:'https://storage.googleapis.com/fixture'}}}
  override async upload(_target:any,file:Blob){this.uploads.push(file);if(this.failUpload)throw Error('interrupted')}
}

test('HEIC/HEIF accepts uppercase names, empty/generic MIME and sequence MIME; normal images stay byte-identical',async()=>{
  for(const file of [heic(),heic('slide.heif','application/octet-stream'),heic('photo','image/heic-sequence'),heic('photo','image/heif')]){assert(isHEIC(file,file.name));assert.equal(fileKind(file),'image')}
  for(const ext of ['.heic','.heif'])assert(imageFileAccept.includes(ext))
  const before=calls
  for(const type of ['image/jpeg','image/png','image/webp']){const file=new File(['unchanged'],'photo.'+type.split('/')[1],{type});assert.equal(await prepareImageUpload(file,new AbortController().signal),file)}
  assert.equal(calls,before)
})
test('HEIC bytes become a JPEG with truthful MIME/size and no third-party file upload',async()=>{
  const file=heic(),before=calls;decode=async()=>jpeg()
  const out=await prepareImageUpload(file,new AbortController().signal)
  assert.equal(out.type,'image/jpeg');assert.equal(out.name,'PHOTO.jpg');assert.equal(out.size,8);assert.equal(calls,before+1)
  assert.deepEqual(new Uint8Array(await out.arrayBuffer()),new Uint8Array(await jpeg().arrayBuffer()))
  assert.equal(file.name,'PHOTO.HEIC');assert.notEqual(file.size,out.size)
})
test('Apple picker already-transcoded HEIC filenames do not decode JPEG/PNG a second time',async()=>{
  const before=calls
  const jpg=await prepareImageUpload(new File([jpeg()],'picker.HEIC',{type:'image/heic'}),new AbortController().signal)
  const png=await prepareImageUpload(new File([new Uint8Array([137,80,78,71,13,10,26,10,1])],'picker.heif',{type:''}),new AbortController().signal)
  assert.equal(jpg.type,'image/jpeg');assert.equal(png.type,'image/png');assert.equal(calls,before)
})
test('HEIC decode failure and invalid output fail before cloud admission',async()=>{
  const backend=new Backend(),store=new AIStore(),controller=new AIController(crypto.randomUUID(),context,backend,store,()=>{});await controller.init()
  try{
    decode=async()=>{throw 'private decoder details'}
    await assert.rejects(controller.stageFile(heic()),error=>error instanceof Error&&error.message.includes('HEIC/HEIF')&&!error.message.includes('private'))
    decode=async()=>new Blob(['not a JPEG'],{type:'image/jpeg'})
    await assert.rejects(controller.stageFile(heic()),/HEIC\/HEIF/)
    assert.equal(backend.inputs.length,0);assert.equal(backend.uploads.length,0);assert.equal(controller.materials.length,0)
  }finally{decode=async()=>jpeg();controller.dispose()}
})
test('conversion cancelled by course disposal never creates a source',async()=>{
  const backend=new Backend(),c=new AIController(crypto.randomUUID(),context,backend,new AIStore(),()=>{});await c.init();let release!:(blob:Blob)=>void
  decode=()=>new Promise(r=>{release=r});const preparing=c.stageFile(heic());await until(()=>!!release);c.dispose()
  await assert.rejects(preparing,{name:'AbortError'});release(jpeg());assert.equal(backend.inputs.length,0);decode=async()=>jpeg()
})
test('converted JPEG is durable and interrupted upload retries the same source without HEIC re-decoding',async()=>{
  decode=async()=>jpeg();const backend=new Backend(),store=new AIStore(),uid=crypto.randomUUID(),c=new AIController(uid,context,backend,store,()=>{});await c.init();backend.failUpload=true
  const row=await c.stageFile(heic());await until(()=>row.state==='failed');const sourceId=row.remote!.sourceId,requestId=row.clientRequestId,before=calls
  assert.equal(backend.inputs[0].mime,'image/jpeg');assert.equal(backend.inputs[0].size,8);assert.equal(backend.inputs[0].title,'PHOTO.HEIC')
  const stored=(await store.materials(uid,c.key,c.threadKey))[0];assert.equal(stored.file?.type,'image/jpeg');assert.equal(stored.file?.size,8)
  c.dispose();backend.failUpload=false;const next=new AIController(uid,context,backend,store,()=>{});await next.init()
  try{await next.retry(row.id);assert.equal(backend.inputs.length,1);assert.equal(calls,before);assert.equal(next.materials[0].remote?.sourceId,sourceId);assert.equal(next.materials[0].clientRequestId,requestId);assert(backend.uploads.every(x=>x.type==='image/jpeg'&&x.size===8))}finally{next.dispose()}
})
