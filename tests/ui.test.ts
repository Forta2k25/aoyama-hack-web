import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { indexedDB } from 'fake-indexeddb'
import { makeContext } from '../src/ai/identity.ts'
import { AIStore } from '../src/ai/store.ts'
import { CourseChat as CourseAI } from '../src/components/CourseChat.ts'
import { DemoAIBackend } from '../src/ai/demo.ts'
import type { Evidence, ChatRequest } from '../src/ai/types.ts'
const dom=new JSDOM('<!DOCTYPE html><div id="root"></div>',{url:'http://localhost/ai-debug'})
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true}
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))}
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,indexedDB})
const course={id:'00000000-0000-4000-8000-000000000002',title:'架空の授業',teacher:'架空教員',room:'',firestoreDocID:'00004',academicYear:2026}
class Backend extends DemoAIBackend {
  calls:ChatRequest[]=[]
  override async chat(r:ChatRequest,_s:AbortSignal,delta:(x:string)=>void){this.calls.push(r);delta('<script>alert("no")</script>');return {text:'<img src=x onerror=alert(1)>\nQwenの最終返信'}}
}
test('composer escapes streaming/final raw HTML, preserves tabs and never executes AI HTML',async()=>{
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

test('header materials button opens an isolated drawer, keeps selection and evidence there, and cleans up on dispose',async()=>{
  const root=document.getElementById('root')!,toolbar=document.createElement('div');document.body.append(toolbar)
  const context=makeContext(course,crypto.randomUUID()),source={sourceId:crypto.randomUUID(),sourceType:'note' as const,title:'保存した架空メモ',status:'ready' as const,courseOfferingId:'2026:00004',lectureId:String(context.dayID)}
  const view=new CourseAI(root,course,crypto.randomUUID(),new DemoAIBackend([{source,text:'資料の本文確認'}]),new AIStore(),context,toolbar)
  await view.mount()
  const toggle=toolbar.querySelector<HTMLButtonElement>('button')!,panel=root.querySelector<HTMLDialogElement>('.ai-materials-dialog')!
  assert.equal(toggle.textContent,'資料 (1)');assert.equal(toggle.getAttribute('aria-expanded'),'false');assert(!panel.open)
  assert.equal(root.querySelector('.ai-materials')!.parentElement!.closest('dialog'),panel);assert.equal(root.querySelector('.ai-evidence')!.closest('dialog'),panel)
  toggle.click();assert(panel.open);assert.equal(toggle.getAttribute('aria-expanded'),'true')
  const check=panel.querySelector<HTMLInputElement>('input[type=checkbox]')!;assert(check.checked);check.checked=false;check.dispatchEvent(new dom.window.Event('change'))
  panel.close();assert.equal(toggle.getAttribute('aria-expanded'),'false');toggle.click();assert(!panel.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked)
  ;[...panel.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent==='本文')!.click()
  for(let i=0;i<100&&!panel.textContent!.includes('資料の本文確認');i++)await new Promise(r=>setTimeout(r,3))
  assert(panel.textContent!.includes('資料の本文確認'));assert(!root.querySelector('.ai-thread')!.textContent!.includes('資料の本文確認'))
  view.dispose();assert(!panel.isConnected);assert(!toolbar.children.length);toolbar.remove()
})

test('CourseChat renders streamed and final Markdown/math, persists raw answer, reloads it, and copies it unchanged',async()=>{
 const answer='### (b) の答え\n\n**答え：$n=9$**\n\n公比は $r=\\log_2(1.5)$ です。\n\n$$\\frac{5r^n}{1-r}<0.1$$\n\n- n=8: 約0.16516\n- n=9: 約0.09661'
 class MathBackend extends DemoAIBackend {override async chat(_r:ChatRequest,_s:AbortSignal,delta:(x:string)=>void){for(const ch of answer)delta(ch);return {text:answer}}}
 const uid=crypto.randomUUID(),store=new AIStore(),context=makeContext(course,crypto.randomUUID()),root=document.getElementById('root')!,view=new CourseAI(root,course,uid,new MathBackend(),store,context)
 let copied='';Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:async(text:string)=>{copied=text}}},configurable:true})
 await view.mount();root.querySelector('textarea')!.value='最小のnを求めて';root.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}))
 for(let i=0;i<100&&!root.querySelector('.ai-answer-copy');i++)await new Promise(r=>setTimeout(r,3))
 for(let i=0;i<100&&root.querySelector('.ai-message-actions')?.hasAttribute('hidden');i++)await new Promise(r=>setTimeout(r,3))
 assert.equal(root.querySelector('.ai-message--assistant h3')?.textContent,'(b) の答え');assert(root.querySelector('.ai-message--assistant strong .katex'));assert.equal(root.querySelectorAll('.ai-message--assistant .katex').length,3)
 root.querySelector<HTMLButtonElement>('.ai-answer-copy')!.click();await new Promise(r=>setTimeout(r,0));assert.equal(copied,answer)
 view.dispose();const reloaded=new CourseAI(root,course,uid,new MathBackend(),store,context);await reloaded.mount();assert(root.querySelector('.ai-message--assistant mfrac'));assert.equal(root.querySelectorAll('.ai-message--assistant .katex').length,3);reloaded.dispose()
})

test('composer can move down to a compact bar without losing a draft or sending it; reopen restores focus',async()=>{
 const root=document.getElementById('root')!,backend=new Backend(),view=new CourseAI(root,course,crypto.randomUUID(),backend)
 await view.mount();const input=root.querySelector('textarea')!,toggle=root.querySelector<HTMLButtonElement>('.ai-composer-toggle')!,body=root.querySelector<HTMLElement>('.ai-composer-body')!
 input.value='まだ送らない下書き';assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(toggle.getAttribute('aria-controls'),body.id)
 toggle.click();assert(body.hidden);assert.equal(toggle.getAttribute('aria-expanded'),'false');assert(root.querySelector<HTMLElement>('.ai-suggestions')!.hidden);assert(root.querySelector<HTMLElement>('.ai-composer-caption')!.hidden)
 root.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(backend.calls.length,0);assert.equal(input.value,'まだ送らない下書き')
 toggle.click();assert(!body.hidden);assert.equal(input.value,'まだ送らない下書き');assert.equal(document.activeElement,input);assert(!root.querySelector<HTMLElement>('.ai-suggestions')!.hidden);assert(!root.querySelector<HTMLElement>('.ai-composer-caption')!.hidden);view.dispose()
})
test('compact composer keeps analysis waiting status and generation stop available',async()=>{
 const root=document.getElementById('root')!,view=new CourseAI(root,course,crypto.randomUUID(),new Backend());await view.mount()
 const controller=(view as any).controller;controller.sending=true;(view as any).render()
 root.querySelector<HTMLButtonElement>('.ai-composer-toggle')!.click()
 const stop=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='生成を中断')!;assert(!stop.hidden);assert(!stop.closest('.ai-composer-body'));assert(!root.querySelector('.ai-send-wait')!.closest('.ai-composer-body'))
 controller.sending=false;view.dispose()
})

test('interrupted answer keeps Markdown/math, shows a resume action and completes (h) in the same bubble',async()=>{
 const {ChatStreamError}=await import('../src/ai/chat-stream.ts')
 class RecoveryBackend extends DemoAIBackend {calls=0;override async chat(r:ChatRequest,_s:AbortSignal,delta:(s:string)=>void,progress?:(p:any)=>void){this.calls++;if(this.calls===1){progress?.({status:'retrying',supported:true});delta('### (g)\n\n$D=4(Z^2-1)$\n\n');throw new ChatStreamError(Object.assign(Error('reset'),{code:'functions/unavailable'}),true,r)}delta('### (h)\n\n条件付き確率は約 $0.167$。');return {text:'### (g)\n\n$D=4(Z^2-1)$\n\n### (h)\n\n条件付き確率は約 $0.167$。'}}}
 const root=document.getElementById('root')!,view=new CourseAI(root,course,crypto.randomUUID(),new RecoveryBackend());await view.mount();root.querySelector('textarea')!.value='最後まで説明して';root.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
 for(let i=0;i<100&&(!root.querySelector('.ai-answer-resume')||root.querySelector<HTMLButtonElement>('.ai-answer-resume')!.hidden);i++)await new Promise(r=>setTimeout(r,3))
 assert(root.textContent!.includes('回答が途中で中断'));assert(!root.textContent!.includes('送信に失敗しました。再送は自動で行いません。'));assert(root.querySelector('.ai-message--assistant .katex'));const button=root.querySelector<HTMLButtonElement>('.ai-answer-resume')!;assert(!button.hidden);button.click();
 for(let i=0;i<100&&root.querySelector('.ai-message--assistant h3')?.textContent!=='(h)'&&!root.textContent!.includes('条件付き確率');i++)await new Promise(r=>setTimeout(r,3))
 assert.equal(root.querySelectorAll('.ai-message--assistant').length,1);assert.equal(root.querySelectorAll('.ai-message--user').length,1);assert(root.textContent!.includes('条件付き確率'));view.dispose()
})
