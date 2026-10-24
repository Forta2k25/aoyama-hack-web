import test from 'node:test'
import assert from 'node:assert/strict'
import {indexedDB} from 'fake-indexeddb'
import {AIStore} from '../src/ai/store.ts'
import {syncConversation,toSyncedMessage,dayIDOf} from '../src/ai/message-sync.ts'
import {courseKey,sessionKey} from '../src/ai/identity.ts'
import type {AIBackend,CourseContext,Message,RemoteMessage,SyncedMessage} from '../src/ai/types.ts'
Object.assign(globalThis,{indexedDB})
const DAY=Math.floor(Date.parse('2026-10-13')/86400000)
const context=(dayID=DAY):CourseContext=>({localCourseId:'sync-course',localCourseUUID:'11111111-1111-4111-8111-111111111111',year:2026,semester:'fall',courseName:'架空の授業',teacherName:'架空教員',dayID})
const uid='sync-owner'
const message=(id:string,role:'user'|'assistant',text:string,createdAt:number,day=DAY,extra:Partial<Message>={}):Message=>({id,uid,courseKey:courseKey(context()),sessionKey:sessionKey(context(day)),role,text,sourceIds:[],state:'done',createdAt,...extra})
class FakeServer{
  saved:{day:number;rows:SyncedMessage[]}[]=[];remote:RemoteMessage[]=[]
  backend():AIBackend{
    const self=this
    return {demo:true,async saveMessages(ctx:CourseContext,rows:SyncedMessage[]){self.saved.push({day:ctx.dayID,rows});for(const r of rows)self.remote.push({...r,kind:r.kind,dayID:ctx.dayID,semester:ctx.semester,imageCount:r.imageCount??0})},async listMessages(){return [...self.remote]}} as unknown as AIBackend
  }
}
test('未同期の文章だけを、授業回ごとに送り、送ったものには、同期ずみの印を付ける',async()=>{
  const store=new AIStore(),server=new FakeServer()
  const sent=[message('m-user-1','user','こんにちは',1_790_000_000_000),message('m-asst-1','assistant','こんにちは！',1_790_000_001_000),message('m-other-day','user','別の回の質問',1_790_000_002_000,DAY+7),message('m-fail','assistant','途中',1_790_000_003_000,DAY,{state:'interrupted'})]
  for(const m of sent)await store.putMessage(m)
  await syncConversation(server.backend(),store,uid,context(),new AbortController().signal)
  assert.deepEqual(server.saved.map(x=>[x.day,x.rows.map(r=>r.id)]).sort((a,b)=>a[0]-b[0]),[[DAY,['m-user-1','m-asst-1']],[DAY+7,['m-other-day']]])
  const after=await store.messages(uid,courseKey(context()))
  assert.deepEqual(after.filter(m=>m.synced).map(m=>m.id).sort(),['m-asst-1','m-other-day','m-user-1'])
  assert(!after.find(m=>m.id==='m-fail')!.synced,'中断した発言は送らない')
  server.saved.length=0
  await syncConversation(server.backend(),store,uid,context(),new AbortController().signal)
  assert.equal(server.saved.length,0,'送ったものは、もう一度送らない')
})
test('アプリから届いた発言と画像の印を取り込み、重複させない',async()=>{
  const store=new AIStore(),server=new FakeServer()
  server.remote=[{id:'app-q',role:'user',kind:'text',text:'アプリからの質問',imageCount:0,dayID:DAY,semester:'fall',createdAt:1_790_000_100_000},
    {id:'app-img',role:'user',kind:'image',text:'',imageCount:3,dayID:DAY,semester:'fall',createdAt:1_790_000_090_000},
    {id:'app-a',role:'assistant',kind:'text',text:'アプリでの返信',imageCount:0,dayID:DAY,semester:'fall',createdAt:1_790_000_101_000}]
  const added=await syncConversation(server.backend(),store,uid,context(),new AbortController().signal)
  assert.deepEqual(added.map(m=>m.id).sort(),['app-a','app-img','app-q'])
  const image=(await store.messages(uid,courseKey(context()),sessionKey(context()))).find(m=>m.id==='app-img')!
  assert.equal(image.attachmentKind,'image');assert.equal(image.imageCount,3);assert.equal(image.text,'');assert(image.synced)
  assert.equal((await syncConversation(server.backend(),store,uid,context(),new AbortController().signal)).length,0)
  assert.equal(toSyncedMessage(image),undefined,'画像の印は、サーバーへ送り返さない')
  assert.equal(dayIDOf(image),DAY)
})
test('同期に対応しない接続(デモ)では、何もしない',async()=>{
  const store=new AIStore()
  assert.deepEqual(await syncConversation({demo:true} as unknown as AIBackend,store,uid,context(),new AbortController().signal),[])
})
