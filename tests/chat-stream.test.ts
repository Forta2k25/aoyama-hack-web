import test from 'node:test'
import assert from 'node:assert/strict'
import {receiveChat,ChatStreamError,CHAT_RESUME_PROTOCOL} from '../src/ai/chat-stream.ts'
import {AIController} from '../src/ai/controller.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import {AIStore} from '../src/ai/store.ts'
import {indexedDB} from 'fake-indexeddb'
import type {ChatRequest,ChatReply,ChatProgress} from '../src/ai/types.ts'
Object.assign(globalThis,{indexedDB})
const context={localCourseId:'test-stream-course',localCourseUUID:'test-stream-course',courseName:'架空授業',teacherName:'',year:2026,classDocId:'00004',dayID:20000}
const request:ChatRequest={context,sourceIds:['owned-source'],turns:[{role:'user',text:'(a)から(h)まで説明して'}],mode:'reply',requestId:crypto.randomUUID(),generationId:crypto.randomUUID()}
const protocol=CHAT_RESUME_PROTOCOL,unavailable=()=>Object.assign(Error('reset'),{code:'functions/unavailable'}),sleep=async()=>{}
const success=(text:string)=>({stream:(async function*(){yield {protocol,delta:text}})(),data:Promise.resolve({text})})
test('short response uses one call, no recovery wait, authoritative final reply replaces provisional text',async()=>{
 let calls=0,seen='';const r=await receiveChat(request,new AbortController().signal,s=>seen+=s,()=>{},async()=>{calls++;return {stream:(async function*(){yield {delta:'途中'}})(),data:Promise.resolve({text:'完成した短文'})}},{sleep:async()=>{throw Error('must not delay')}});assert.equal(calls,1);assert.equal(seen,'途中');assert.equal(r.text,'完成した短文')
})
test('stream reset resumes with original question + exact partial, same generation, appends only new tail',async()=>{
 const calls:ChatRequest[]=[],states:ChatProgress[]=[],seen:string[]=[]
 const r=await receiveChat(request,new AbortController().signal,x=>seen.push(x),x=>states.push(x),async data=>{calls.push(structuredClone(data));if(calls.length===1)return {stream:(async function*(){yield {protocol,status:'generating'};yield {delta:'(a)〜(f)の説明。'};throw unavailable()})(),data:Promise.reject(unavailable())};assert.equal(data.resume?.partial,'(a)〜(f)の説明。');assert.deepEqual(data.turns,request.turns);assert.equal(data.generationId,request.generationId);return {stream:(async function*(){yield {protocol,delta:'(g)条件。\n(h)最後の答え。'}})(),data:Promise.resolve({text:'(a)〜(f)の説明。(g)条件。\n(h)最後の答え。',recognition:{totalTokens:10,estimatedCostUSD:.001}})}},{sleep})
 assert.equal(calls.length,2);assert.equal(seen.join(''),r.text);assert(states.some(s=>s.status==='retrying'));assert.equal(r.recognition?.totalTokens,null);assert.equal(r.recognition?.estimatedCostUSD,null)
})
test('EOF without final callable event recovers instead of waiting forever; retries stop at two',async()=>{
 let n=0,delays:number[]=[];await assert.rejects(receiveChat(request,new AbortController().signal,()=>{},()=>{},async()=>{n++;return {stream:(async function*(){yield {protocol,delta:'途中の文章。'}})(),data:new Promise<ChatReply>(()=>{})}},{finalMs:1,sleep:async ms=>{delays.push(ms)}}),e=>e instanceof ChatStreamError&&e.canResume);assert.equal(n,3);assert.deepEqual(delays,[500,1500])
})
test('old server, 401/403/400, malformed event and explicit cancel never silently repeat a billable request',async()=>{
 for(const code of ['functions/permission-denied','functions/unauthenticated','functions/invalid-argument','CHAT_STREAM_MALFORMED']){let n=0;await assert.rejects(receiveChat(request,new AbortController().signal,()=>{},()=>{},async()=>{n++;return {stream:(async function*(){yield {protocol};throw Object.assign(Error('blocked'),{code})})(),data:Promise.reject(Object.assign(Error('blocked'),{code}))}},{sleep}),e=>e instanceof ChatStreamError&&!e.canResume);assert.equal(n,1)}
 let n=0;await assert.rejects(receiveChat(request,new AbortController().signal,()=>{},()=>{},async()=>{n++;return {stream:(async function*(){yield {delta:'旧backendの途中本文'};throw unavailable()})(),data:Promise.reject(unavailable())}},{sleep}));assert.equal(n,1)
 const ac=new AbortController();n=0;await assert.rejects(receiveChat(request,ac.signal,()=>{},()=>{},async()=>{n++;return {stream:(async function*(){yield {protocol,delta:'途中'};ac.abort();throw unavailable()})(),data:Promise.reject(unavailable())}},{sleep}),e=>e instanceof ChatStreamError);assert.equal(n,1)
})
test('controller keeps interrupted text, resumes same message without a duplicate user turn, saves/reloads final (h)',async()=>{
 class Backend extends DemoAIBackend{n=0;override async chat(r:ChatRequest,_s:AbortSignal,delta:(s:string)=>void){this.n++;if(this.n===1){delta('(a)〜(g)の途中本文。');throw new ChatStreamError(unavailable(),true,r)}assert.equal(r.resume?.partial,'(a)〜(g)の途中本文。');delta('(h)完了。');return {text:'(a)〜(g)の途中本文。(h)完了。'}}}
 const backend=new Backend(),store=new AIStore(),uid=crypto.randomUUID(),c=new AIController(uid,context,backend,store,()=>{});await c.init();assert.equal(await c.send('最後まで説明して'),false);const m=c.messages.at(-1)!;assert.equal(m.state,'interrupted');assert.equal(m.text,'(a)〜(g)の途中本文。');assert(m.canResume);assert.equal(await c.resume(m.id),true);assert.equal(m.text,'(a)〜(g)の途中本文。(h)完了。');assert.equal(m.state,'done');assert.equal(c.messages.length,2);c.dispose();const next=new AIController(uid,context,backend,store,()=>{});await next.init();assert.equal(next.messages.at(-1)?.text,m.text);next.dispose()
})

test('server exhausted its own recovery budget: keep partial and offer manual resume, never multiply automatic retries',async()=>{
 let n=0;await assert.rejects(receiveChat(request,new AbortController().signal,()=>{},()=>{},async()=>{n++;const e=Object.assign(Error('limit'),{code:'functions/failed-precondition',details:{code:'CHAT_OUTPUT_LIMIT',retryable:true}});return {stream:(async function*(){yield {protocol,delta:'途中の回答'};throw e})(),data:Promise.reject(e)}},{sleep}),e=>e instanceof ChatStreamError&&e.canResume);assert.equal(n,1)
});
