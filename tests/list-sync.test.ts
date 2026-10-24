import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {indexedDB} from 'fake-indexeddb'
import {CourseAI} from '../src/components/CourseAI.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import {AIStore} from '../src/ai/store.ts'
import type {CourseContext,RemoteMessage,SyncedMessage} from '../src/ai/types.ts'
const dom=new JSDOM('<!DOCTYPE html><div id="root"></div>',{url:'http://localhost/mypage'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,indexedDB})
// 同期できる接続(デモの見た目に、会話の保存・取得を足したもの)
class SyncBackend extends DemoAIBackend{
 remote:RemoteMessage[]=[];listCalls=0
 constructor(){super();Object.defineProperty(this,'demo',{value:false})}
 async saveMessages(_c:CourseContext,rows:SyncedMessage[]){for(const r of rows)this.remote.push({...r,dayID:20000,imageCount:r.imageCount??0})}
 async listMessages(){this.listCalls++;return [...this.remote]}
}
const flush=async(check:()=>boolean)=>{for(let i=0;i<200&&!check();i++)await new Promise(r=>setTimeout(r,3));assert(check(),'UI did not settle')}
test('授業回の一覧は、チャットを開かなくても、別の端末の発言を取り込んで、「最後の発言」を更新する',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-15T12:00:00Z')})
 const root=document.getElementById('root')!,backend=new SyncBackend(),store=new AIStore(),uid=crypto.randomUUID()
 const course={id:'#####',title:'架空の火曜授業A',teacher:'架空教員',room:'',academicYear:2026,semester:'fall',meetingDay:1,campus:'青山',timetableRecord:'assignedCourses.2026_後期:cells.d1p2'}
 const view=new CourseAI(root,course,uid,backend,store);await view.mount()
 assert.match(root.textContent!,/まだ記録がありません/)
 // 別の端末(アプリ)が、同じ授業の最新の回(2026-10-13)に、質問と画像を送った
 const day=Math.floor(Date.parse('2026-10-13')/86400000)
 backend.remote=[{id:'app-q',role:'user',kind:'text',text:'アプリからの質問',imageCount:0,dayID:day,createdAt:Date.now()-2000},
  {id:'app-img',role:'user',kind:'image',text:'',imageCount:2,dayID:day,createdAt:Date.now()-1000}]
 // 一覧が出たまま、同期(30秒ごと・購読の知らせ)が走ると、一覧の表示が変わる
 await (view as unknown as {syncList():Promise<void>}).syncList()
 await flush(()=>root.textContent!.includes('画像を送りました'))
 assert(!root.textContent!.includes('アプリからの質問'),'最後の発言は、画像の印')
 view.dispose()
})
