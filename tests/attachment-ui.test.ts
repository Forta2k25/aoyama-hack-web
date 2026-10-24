import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {indexedDB} from 'fake-indexeddb'
import {CourseChat} from '../src/components/CourseChat.ts'
import {AIStore} from '../src/ai/store.ts'
import {DemoAIBackend} from '../src/ai/demo.ts'
import type {Receipt,ChatRequest,Message} from '../src/ai/types.ts'
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/ai-debug'})
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true}
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'))}
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,indexedDB})
const course={id:'synthetic-course',title:'架空の授業',teacher:'架空教員',room:'',firestoreDocID:'00004',academicYear:2026}
const context={localCourseUUID:'synthetic-course',classDocId:'00004',year:2026,dayID:20741,courseName:course.title,teacherName:course.teacher}
const until=async(check:()=>boolean)=>{for(let i=0;i<200&&!check();i++)await new Promise(r=>setTimeout(r,5));assert(check(),'UI did not settle')}
class Backend extends DemoAIBackend{
 inputs:any[]=[];uploads=0;failUpload=false;ready=false;release!:()=>void;wait=new Promise<void>(resolve=>{this.release=resolve})
 override async create(input:any):Promise<Receipt>{this.inputs.push(input);return {...await super.create(input),status:'awaiting_upload',upload:{url:'https://storage.googleapis.com/fixture'}}}
 override async retry(id:string):Promise<Receipt>{return {...await super.retry(id),status:'awaiting_upload',upload:{url:'https://storage.googleapis.com/fixture'}}}
 override async upload(_target:any,_file:Blob,_signal:AbortSignal,progress:(n:number)=>void){this.uploads++;progress(37);if(this.failUpload)throw Error('interrupted');await this.wait}
 override async get(id:string){return {...await super.get(id),status:this.ready?'ready' as const:'extracting' as const}}
}
test('composer thumbnail reports real upload/analysis states, preserves preview nodes and revokes URLs when dismissed',async t=>{
 const made:string[]=[],released:string[]=[];t.mock.method(URL,'createObjectURL',()=>{const url='blob:synthetic-'+made.length;made.push(url);return url});t.mock.method(URL,'revokeObjectURL',(url:string)=>{released.push(url)})
 const root=document.getElementById('root')!,backend=new Backend(),view=new CourseChat(root,course,crypto.randomUUID(),backend,new AIStore(),context);await view.mount();const controller=(view as any).controller
 try{
  const row=await controller.stageFile(new File(['synthetic JPEG bytes'],'写真.jpg',{type:'image/jpeg'}));await until(()=>backend.uploads===1)
  const tray=root.querySelector<HTMLElement>('.ai-composer-attachments')!,img=tray.querySelector('img')!,card=tray.firstElementChild;assert.equal(tray.closest('form'),root.querySelector('form'));assert.equal(img.getAttribute('src'),made[0]);assert.match(tray.textContent!,/写真.jpg/);assert.match(tray.textContent!,/アップロード中 37%/);assert(!tray.textContent!.includes('アップロード済み'));assert(!root.querySelector<HTMLDialogElement>('.ai-materials-dialog')!.open)
  backend.release();await until(()=>row.state==='processing'&&tray.textContent!.includes('アップロード済み・解析中'));assert.match(tray.textContent!,/アップロード済み・解析中/);assert.equal(tray.firstElementChild,card);assert.equal(tray.querySelector('img'),img);assert.equal(made.length,1)
  backend.ready=true;await controller.poll();assert.match(tray.textContent!,/アップロード・解析完了/);assert(controller.selected.has(row.id))
  tray.querySelector<HTMLButtonElement>('.ai-attachment-dismiss')!.click();assert.equal(tray.children.length,0);assert(tray.hidden);assert.equal(controller.materials.length,1);assert(!controller.selected.has(row.id));assert.deepEqual(released,made)
 }finally{view.dispose()}
})
test('failed uploads stay visible with retry and never claim upload success or create a duplicate source',async()=>{
 const root=document.getElementById('root')!,backend=new Backend(),view=new CourseChat(root,course,crypto.randomUUID(),backend,new AIStore(),context);backend.failUpload=true;await view.mount();const c=(view as any).controller
 try{const row=await c.stageFile(new File(['synthetic image'],'再送.png',{type:'image/png'}));const tray=root.querySelector<HTMLElement>('.ai-composer-attachments')!;await until(()=>row.state==='failed'&&tray.textContent!.includes('失敗・再送できます'));assert.match(tray.textContent!,/失敗・再送できます/);assert(!tray.textContent!.includes('アップロード済み'));const source=row.remote.sourceId
 backend.failUpload=false;backend.release();tray.querySelector<HTMLButtonElement>('.ai-attachment-retry')!.click();await until(()=>row.state==='processing'&&tray.textContent!.includes('アップロード済み・解析中'));assert.match(tray.textContent!,/アップロード済み・解析中/);assert.equal(backend.inputs.length,1);assert.equal(row.remote.sourceId,source)
 }finally{view.dispose()}
})
test('remote-only PDF/audio/note use file cards without requesting signed source images or exposing other courses',async()=>{
 const root=document.getElementById('root')!,sources=['pdf','audio','note'].map((type,i)=>({source:{sourceId:'source-'+i,sourceType:type as 'pdf'|'audio'|'note',title:'架空資料-'+type,status:'ready' as const,courseOfferingId:'2026:00004',lectureId:String(context.dayID)}}))
 sources.push({source:{...sources[0].source,sourceId:'foreign-course',courseOfferingId:'2026:00005',title:'別授業の非表示資料'}})
 const view=new CourseChat(root,course,crypto.randomUUID(),new DemoAIBackend(sources),new AIStore(),context);await view.mount()
 try{const tray=root.querySelector<HTMLElement>('.ai-composer-attachments')!;assert.equal(tray.querySelectorAll('.ai-attachment-card').length,3);assert.match(tray.textContent!,/PDF/);assert.match(tray.textContent!,/音声/);assert.match(tray.textContent!,/メモ/);assert.equal(tray.querySelectorAll('img[src]').length,0);assert(!tray.textContent!.includes('別授業'))}finally{view.dispose()}
})
test('completed assistant replies have copy/share actions; streaming replies cannot export and only answer text leaves the UI',async()=>{
 const copied:string[]=[],shared:ShareData[]=[];Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:async(text:string)=>{copied.push(text)}},share:async(data:ShareData)=>{shared.push(data)}},configurable:true})
 const backend=new DemoAIBackend(),root=document.getElementById('root')!,view=new CourseChat(root,course,crypto.randomUUID(),backend,new AIStore(),context);await view.mount();const c=(view as any).controller
 try{const answer:Message={id:crypto.randomUUID(),uid:c.uid,courseKey:c.key,role:'assistant',text:'回答の全文\n\t<script>実行しない</script>',sourceIds:['private-source-id'],state:'sending',createdAt:Date.now()};c.messages.push(answer);(view as any).render()
 const actions=root.querySelector<HTMLElement>('.ai-message-actions')!;assert(actions.hidden);actions.querySelector<HTMLButtonElement>('.ai-answer-copy')!.click();await Promise.resolve();assert.equal(copied.length,0)
 answer.state='done';(view as any).render();assert(!actions.hidden);actions.querySelector<HTMLButtonElement>('.ai-answer-copy')!.click();await until(()=>actions.textContent!.includes('コピーしました'));assert.deepEqual(copied,[answer.text]);assert.equal(root.querySelectorAll('script').length,0)
 actions.querySelector<HTMLButtonElement>('.ai-answer-share')!.click();await until(()=>actions.textContent!.includes('共有画面に渡しました'));assert.deepEqual(shared,[{title:'架空の授業のAI回答',text:answer.text}]);assert(!JSON.stringify(shared).includes('private-source-id'))
 }finally{view.dispose()}
})

test('a pending native share cannot launch twice and does not block the independent copy button',async()=>{
 let release!:()=>void,shareCount=0;const copied:string[]=[]
 Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:async(text:string)=>{copied.push(text)}},share:()=>{shareCount++;return new Promise<void>(r=>{release=r})}},configurable:true})
 const root=document.getElementById('root')!,view=new CourseChat(root,course,crypto.randomUUID(),new DemoAIBackend(),new AIStore(),context);await view.mount();const c=(view as any).controller
 try{const answer:Message={id:crypto.randomUUID(),uid:c.uid,courseKey:c.key,role:'assistant',text:'共有待ち中もコピーできる回答',sourceIds:[],state:'done',createdAt:Date.now()};c.messages.push(answer);(view as any).render()
 const share=root.querySelector<HTMLButtonElement>('.ai-answer-share')!,copy=root.querySelector<HTMLButtonElement>('.ai-answer-copy')!;share.click();assert(share.disabled);assert(!copy.disabled);share.click();assert.equal(shareCount,1);copy.click();await until(()=>copied.length===1);assert.deepEqual(copied,[answer.text]);release();await until(()=>!share.disabled)
 }finally{view.dispose()}
})

test('a restored awaiting-upload receipt never displays an upload-success badge and offers retry',async()=>{
 const source={sourceId:'synthetic-awaiting-upload',sourceType:'image' as const,title:'送信前の写真.jpg',status:'awaiting_upload' as const,courseOfferingId:'2026:00004',lectureId:String(context.dayID)},root=document.getElementById('root')!,view=new CourseChat(root,course,crypto.randomUUID(),new DemoAIBackend([{source}]),new AIStore(),context);await view.mount()
 try{const tray=root.querySelector<HTMLElement>('.ai-composer-attachments')!;assert.match(tray.textContent!,/アップロード未完了/);assert(!tray.textContent!.includes('アップロード済み'));assert(!tray.textContent!.includes('解析完了'));assert(!tray.querySelector<HTMLButtonElement>('.ai-attachment-retry')!.hidden)}finally{view.dispose()}
})

test('composer and Enter submissions are blocked during upload/analysis, show backend page progress and keep the draft until ready',async()=>{
 const root=document.getElementById('root')!,backend=new Backend(),view=new CourseChat(root,course,crypto.randomUUID(),backend,new AIStore(),context);await view.mount();const c=(view as any).controller
 let chats=0;backend.chat=async()=>{chats++;return {text:'完了資料を使った架空回答'}}
 try{
  const row=await c.stageFile(new File(['synthetic PDF'],'解析待ち.pdf',{type:'application/pdf'}));await until(()=>backend.uploads===1)
  const send=root.querySelector<HTMLButtonElement>('.ai-send')!,form=root.querySelector('form')!,input=root.querySelector<HTMLTextAreaElement>('.ai-composer-input')!,wait=root.querySelector<HTMLElement>('.ai-send-wait')!
  input.value='この資料を要約して';assert(send.disabled);assert(!input.disabled);assert(!wait.hidden);form.requestSubmit();input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await Promise.resolve();assert.equal(chats,0);assert.equal(c.messages.length,0);assert.equal(input.value,'この資料を要約して')
  backend.release();await until(()=>row.state==='processing');row.remote.status='extracting';row.remote.previewProgress={completed:12,total:30};(view as any).render()
  const tray=root.querySelector<HTMLElement>('.ai-composer-attachments')!,progress=tray.querySelector('progress')!;assert.match(tray.textContent!,/12\/30ページ解析済み（40%）/);assert.equal(progress.value,12);assert.equal(progress.max,30);assert(send.disabled)
  row.remote.status='indexing';row.remote.previewProgress={completed:30,total:30};(view as any).render();assert(send.disabled);assert.match(tray.textContent!,/解析結果を保存中/);form.requestSubmit();assert.equal(chats,0)
  backend.ready=true;await c.poll();assert(!send.disabled);assert(wait.hidden);assert(tray.querySelector<HTMLProgressElement>('progress')!.hidden);assert.equal(input.value,'この資料を要約して');form.requestSubmit();await until(()=>chats===1&&input.value==='');assert(c.messages[0].sourceIds.includes(row.remote.sourceId))
 }finally{view.dispose()}
})
