import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { indexedDB } from 'fake-indexeddb'
import { CourseAI } from '../src/components/CourseAI.ts'
import { DemoAIBackend } from '../src/ai/demo.ts'
import type { Evidence, ChatRequest } from '../src/ai/types.ts'
const dom=new JSDOM('<!DOCTYPE html><div id="root"></div>',{url:'http://localhost/ai-debug'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,indexedDB})
const course={id:'00000000-0000-4000-8000-000000000002',title:'架空の授業',teacher:'架空教員',room:'',firestoreDocID:'00004',academicYear:2026}
class Backend extends DemoAIBackend {
  calls:ChatRequest[]=[]
  override async chat(r:ChatRequest,_s:AbortSignal,delta:(x:string)=>void){this.calls.push(r);delta('<script>alert("no")</script>');return {text:'<img src=x onerror=alert(1)>\nQwenの最終返信'}}
}
test('composer renders streaming/final content as text, preserves tabs and never executes AI HTML',async()=>{
  const root=document.getElementById('root')!,backend=new Backend(),view=new CourseAI(root,course,crypto.randomUUID(),backend)
  await view.mount();const input=root.querySelector('textarea')!;input.value='要約して';root.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}))
  for(let i=0;i<50&&!root.textContent!.includes('Qwenの最終返信');i++)await new Promise(r=>setTimeout(r,5))
  assert(root.textContent!.includes('<img src=x onerror=alert(1)>'));assert.equal(root.querySelectorAll('img,script').length,0);assert.equal(backend.calls.length,1);view.dispose()
})
test('preview is visibly outside search; canonical final text replaces preview without appending OCR',async()=>{
  const root=document.getElementById('root')!,view=new CourseAI(root,course,crypto.randomUUID(),new Backend());await view.mount()
  const preview:Evidence={status:'extracting',preview:true,items:[{chunkId:'1',text:'途中の本文',method:'native_text',locator:{pageNumber:4}}],pipelineVersion:'pdf-auto-v1'}
  ;(view as any).renderEvidence(preview,true);assert.match(root.textContent!,/途中結果・検索対象外/)
  ;(view as any).renderEvidence({...preview,status:'ready',preview:false,items:[{...preview.items[0],text:'Observation → Question',method:'multimodal_ai'}],recognition:{provider:'groq',model:'qwen/qwen3.8-27b'}},false)
  assert(root.textContent!.includes('Observation → Question'));assert(!root.textContent!.includes('途中の本文'));assert(root.textContent!.includes('qwen/qwen3.8-27b'));view.dispose()
})
