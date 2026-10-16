import { prepareImageUpload } from './image'
import { audioDurationSeconds } from './media'
import { courseKey, offeringId, sessionKey, dateForDayID } from './identity'
import { fileKind, mimeFor, safeError } from './format'
import { AIStore } from './store'
import type { AIBackend, CourseContext, LocalMaterial, Message, Receipt, RemoteSource, SourceKind } from './types'

// Persist only DTO fields. Signed upload URLs, tokens and request headers never enter IndexedDB.
export function persistentSource(source:Receipt):RemoteSource {
  const {sourceId,sourceType,title,status,courseOfferingId,lectureId,pipelineVersion,activeVersion,previewVersion,previewProgress,recognition,latency,error}=source
  return {sourceId,sourceType,title,status,courseOfferingId,lectureId,pipelineVersion,activeVersion,previewVersion,previewProgress,recognition,latency,error}
}
export class AIController {
  materials:LocalMaterial[]=[]; messages:Message[]=[]; selected=new Set<string>(); uploadProgress=new Map<string,number>()
  loading=true; error=''; sending=false; private lifetime=new AbortController(); private reply?:AbortController
  private requests=new Map<string,AbortController>(); private timer?:ReturnType<typeof setTimeout>; private polls=0
  readonly key:string;readonly threadKey:string
  readonly uid:string;readonly context:CourseContext;readonly backend:AIBackend;readonly store:AIStore;private readonly changed:()=>void
  constructor(uid:string,context:CourseContext,backend:AIBackend,store:AIStore,changed:()=>void){this.uid=uid;this.context=context;this.backend=backend;this.store=store;this.changed=changed;this.key=courseKey(context);this.threadKey=sessionKey(context)}
  private notify(){if(!this.lifetime.signal.aborted)this.changed()}
  private async save(row:LocalMaterial){await this.store.putMaterial(row);this.notify()}
  async init(){
    try{
      const [materials,messages]=await Promise.all([this.store.materials(this.uid,this.key,this.threadKey),this.store.messages(this.uid,this.key,this.threadKey)])
      this.lifetime.signal.throwIfAborted();this.materials=materials;this.messages=messages
      for(const m of messages)if(m.state==='sending'){m.state='interrupted';await this.store.putMessage(m)}
      for(const m of materials){if(m.state==='uploading'){m.state='failed';m.error='送信が中断されました。同じ送信IDで再送できます。';await this.store.putMaterial(m)}if(this.selected.size<8&&['ready','partial_ready'].includes(m.remote?.status ?? ''))this.selected.add(m.id)}
      const remote=await this.backend.list(this.context,this.lifetime.signal)
      this.lifetime.signal.throwIfAborted()
      for(const source of remote){
        if(source.status==='deleted')continue
        // Refuse cross-course or unassigned remote rows, even if a list API returns more than requested.
        const canonical=offeringId(this.context),known=this.materials.find(x=>x.remote?.sourceId===source.sourceId)
        const knownOffering=this.materials.find(x=>x.remote?.courseOfferingId)?.remote?.courseOfferingId
        if(canonical?source.courseOfferingId!==canonical:source.courseOfferingId!==knownOffering)continue
        if(!known&&![''+this.context.dayID,`day-${this.context.dayID}`,dateForDayID(this.context.dayID)].includes(source.lectureId??''))continue
        let local=this.materials.find(x=>x.remote?.sourceId===source.sourceId)
        if(!local){local={id:crypto.randomUUID(),uid:this.uid,courseKey:this.key,sessionKey:this.threadKey,context:structuredClone(this.context),clientRequestId:crypto.randomUUID(),type:source.sourceType,title:source.title,mime:'',size:0,remote:persistentSource(source),state:'processing',createdAt:Date.now()};this.materials.push(local)}
        local.remote=persistentSource(source);this.applyStatus(local);await this.store.putMaterial(local)
        if(this.selected.size<8&&['ready','partial_ready'].includes(source.status))this.selected.add(local.id)
      }
    }catch(e){if(!this.lifetime.signal.aborted)this.error=safeError(e)}
    finally{this.loading=false;this.notify();if(!this.lifetime.signal.aborted)this.schedule()}
  }
  private applyStatus(row:LocalMaterial){
    const status=row.remote?.status
    row.state=status==='failed'?'failed':status==='deleting'||status==='deleted'?'deleting':status==='ready'||status==='partial_ready'?'ready':'processing'
    row.error=status==='failed'?safeError({details:{code:row.remote?.error?.code}}):undefined
  }
  private schedule(){
    clearTimeout(this.timer)
    if(this.lifetime.signal.aborted)return
    const active=this.materials.some(x=>x.state==='processing'||x.state==='deleting')
    if(!active)return
    const delay=this.polls<10?1000:this.polls<30?2000:3000
    this.timer=setTimeout(()=>void this.poll(),delay)
  }
  private async poll(){
    try{
      for(const row of [...this.materials].filter(x=>x.remote&&(x.state==='processing'||x.state==='deleting'))){
        const remote=await this.backend.get(row.remote!.sourceId,this.lifetime.signal);this.lifetime.signal.throwIfAborted()
        if(remote.sourceId!==row.remote!.sourceId||remote.courseOfferingId!==row.remote!.courseOfferingId)throw Error('WEB_資料の授業識別情報が一致しません。別授業の資料は取り込みません。')
        const becameReady=row.state!=='ready'&&['ready','partial_ready'].includes(remote.status)
        row.remote=persistentSource(remote)
        if(remote.status==='deleted'){await this.store.removeMaterial(row.id);this.materials=this.materials.filter(x=>x.id!==row.id);this.selected.delete(row.id)}else{this.applyStatus(row);await this.save(row)}
        if(becameReady&&this.selected.size<8)this.selected.add(row.id)
      }
      this.error=''
    }catch(e){if(!this.lifetime.signal.aborted)this.error=safeError(e)}
    finally{this.polls++;this.notify();if(!this.lifetime.signal.aborted)this.schedule()}
  }
  async stageFile(file:File){
    const type=fileKind(file),limit=type==='image'?20:type==='pdf'?25:100
    if(!file.size||file.size>limit*1024*1024)throw Error(`WEB_${type==='pdf'?'PDF':type==='image'?'画像':'音声'}は${limit}MB以下の空でないファイルを選んでください。`)
    const prepared=type==='image'?await prepareImageUpload(file,this.lifetime.signal):file
    this.lifetime.signal.throwIfAborted()
    return this.stage(type,file.name,mimeFor(prepared,type),prepared.size,{file:prepared,...(type==='audio'?{durationSeconds:await audioDurationSeconds(file)}:{})})
  }
  async stageNote(text:string){
    if(!text.trim()||text.length>10000)throw Error('WEB_メモは1〜10,000文字で入力してください。')
    return this.stage('note','資料メモ','text/plain',new Blob([text]).size,{text:text.trim()})
  }
  private async stage(type:SourceKind,title:string,mime:string,size:number,content:Pick<LocalMaterial,'file'|'text'|'durationSeconds'>){
    const row:LocalMaterial={id:crypto.randomUUID(),uid:this.uid,courseKey:this.key,sessionKey:this.threadKey,clientRequestId:crypto.randomUUID(),context:structuredClone(this.context),type,title,mime,size,...content,state:'local',createdAt:Date.now()}
    // If the durable write fails (quota/private browsing), do not start any cloud write.
    await this.store.putMaterial(row);this.lifetime.signal.throwIfAborted();this.materials.push(row);this.notify();void this.sendMaterial(row)
    return row
  }
  async retry(id:string){const row=this.materials.find(x=>x.id===id);if(row)await this.sendMaterial(row)}
  private async sendMaterial(row:LocalMaterial){
    if(this.requests.has(row.id)||this.lifetime.signal.aborted)return
    const request=new AbortController(),stop=()=>request.abort();this.lifetime.signal.addEventListener('abort',stop,{once:true});this.requests.set(row.id,request)
    try{
      row.state='uploading';row.error=undefined;await this.save(row)
      if(row.type==='audio'&&!row.durationSeconds){if(!row.file)throw Error('WEB_再送する音声原本がありません。m4aから追加し直してください。');row.durationSeconds=await audioDurationSeconds(row.file);await this.save(row)}
      const receipt=row.remote?await this.backend.retry(row.remote.sourceId,request.signal):await this.backend.create({clientRequestId:row.clientRequestId,type:row.type,title:row.title,mime:row.mime,size:row.size,...(row.text?{text:row.text}:{}),...(row.durationSeconds?{durationSeconds:Math.ceil(row.durationSeconds)}:{}),context:row.context},request.signal)
      request.signal.throwIfAborted();row.remote=persistentSource(receipt);await this.save(row)
      if(row.wantsDeletion){await this.removeRemoteAndLocal(row);return}
      let uploadMs:number|undefined
      if(receipt.upload){
        if(!row.file)throw Error('WEB_再送する原本がこのブラウザにありません。元のファイルから新しく追加してください。')
        const start=performance.now();await this.backend.upload(receipt.upload,row.file,request.signal,n=>{this.uploadProgress.set(row.id,n);this.notify()});uploadMs=performance.now()-start
      }
      if(row.type!=='note'&&['awaiting_upload','queued'].includes(row.remote.status))row.remote=persistentSource(await this.backend.complete(row.remote.sourceId,uploadMs,request.signal))
      request.signal.throwIfAborted();this.applyStatus(row);await this.save(row);this.polls=0;this.schedule()
    }catch(e){if(row.wantsDeletion&&row.remote&&!this.lifetime.signal.aborted){try{await this.removeRemoteAndLocal(row);return}catch(deletionError){e=deletionError}}row.state='failed';row.error=row.wantsDeletion?'削除待ちです。「再送」で同じ送信IDを確認し、削除を完了します。':safeError(e);await this.save(row)}
    finally{this.lifetime.signal.removeEventListener('abort',stop);this.requests.delete(row.id);this.uploadProgress.delete(row.id);this.notify()}
  }
  async delete(id:string){
    const row=this.materials.find(x=>x.id===id);if(!row)return
    row.wantsDeletion=true;await this.save(row)
    if(this.requests.has(id)){
      row.state='deleting';await this.save(row)
      // An admitted create is allowed to return its receipt, then deleted BEFORE upload.
      // An upload can be aborted immediately once we know its remote source ID.
      if(row.remote)this.requests.get(id)?.abort()
      return
    }
    if(!row.remote&&row.state==='failed'){await this.sendMaterial(row);return}
    await this.removeRemoteAndLocal(row)
  }
  private async removeRemoteAndLocal(row:LocalMaterial){
    if(row.remote){row.state='deleting';await this.save(row);await this.backend.delete(row.remote.sourceId,this.lifetime.signal)}
    await this.store.removeMaterial(row.id);this.materials=this.materials.filter(x=>x.id!==row.id);this.selected.delete(row.id);this.notify()
  }
  async evidence(id:string,preview:boolean){const row=this.materials.find(x=>x.id===id);if(!row?.remote)throw Error('WEB_未送信の資料です。');return this.backend.evidence(row.remote.sourceId,preview,this.lifetime.signal)}
  async send(text:string,mode:'reply'|'intro'='reply'){
    if(this.sending)throw Error('WEB_返信を待つか、生成を中断してください。')
    if(mode==='reply'&&(!text.trim()||text.length>2000))throw Error('WEB_メッセージは1〜2,000文字で入力してください。')
    const materials=this.materials.filter(x=>this.selected.has(x.id)&&x.remote&&['ready','partial_ready'].includes(x.remote.status)),sourceIds=materials.map(x=>x.remote!.sourceId)
    if(sourceIds.length>8)throw Error('WEB_一度に参照できる資料は8件までです。')
    if(mode==='intro'&&!sourceIds.length)throw Error('WEB_解析が完了した資料を選んでください。')
    this.lifetime.signal.throwIfAborted()
    this.sending=true;this.reply=new AbortController();const reply=this.reply,stop=()=>reply.abort();this.lifetime.signal.addEventListener('abort',stop,{once:true});this.notify()
    const now=Date.now(),turns=this.messages.filter(x=>x.state==='done').map(x=>({role:x.role,text:x.text.slice(0,2000)}))
    let message:Message|undefined
    try{
      if(mode==='reply'){
        const user:Message={id:crypto.randomUUID(),uid:this.uid,courseKey:this.key,sessionKey:this.threadKey,role:'user',text:text.trim(),sourceIds,state:'done',createdAt:now};await this.store.putMessage(user);this.messages.push(user);turns.push({role:'user',text:user.text})
      }
      reply.signal.throwIfAborted()
      message={id:crypto.randomUUID(),uid:this.uid,courseKey:this.key,sessionKey:this.threadKey,role:'assistant',text:'',sourceIds,state:'sending',createdAt:now+1}
      await this.store.putMessage(message);this.messages.push(message);this.notify();reply.signal.throwIfAborted()
      const recent=turns.slice(-12);if(recent[0]?.role==='assistant')recent.shift()
      const response=await this.backend.chat({context:this.context,courseOfferingId:offeringId(this.context),sourceIds,turns:mode==='intro'?[]:recent,mode},reply.signal,delta=>{message!.text+=delta;this.notify()})
      reply.signal.throwIfAborted();message.text=response.text;message.recognition=response.recognition;message.state='done';return true
    }catch(e){
      if(message){message.state=reply.signal.aborted?'interrupted':'failed';message.text=message.text||safeError(e)}
      this.error=safeError(e);return false
    }finally{
      try{if(message)await this.store.putMessage(message)}finally{this.lifetime.signal.removeEventListener('abort',stop);this.sending=false;this.reply=undefined;this.notify()}
    }
  }

  stop(){this.reply?.abort()}
  dispose(){this.reply?.abort();this.lifetime.abort();clearTimeout(this.timer)}
}
