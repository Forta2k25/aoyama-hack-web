import { validateUpload } from './upload'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth } from '../firebase'
import type { AIBackend, ChatReply, ChatRequest, CourseContext, Evidence, Receipt, RemoteSource, Upload } from './types'

const callableNames = new Set(['aiCreateSource','aiCompleteSource','aiRetrySource','aiGetSource','aiListSources','aiGetEvidence','aiDeleteSource','aiChat'])
export class FirebaseAIBackend implements AIBackend {
  readonly demo=false
  private readonly functions=getFunctions(auth.app,'asia-northeast1')
  private readonly uid:string
  constructor(uid:string) {this.uid=uid}
  private check(signal:AbortSignal){signal.throwIfAborted();if(auth.currentUser?.uid!==this.uid)throw Object.assign(Error('Auth changed'),{code:'AUTH_CHANGED'})}
  private async call<T>(name:string,data:unknown,signal:AbortSignal):Promise<T> {
    this.check(signal);if(!callableNames.has(name))throw Error('Unsupported callable')
    const result=await httpsCallable<unknown,T>(this.functions,name,{timeout:120000})(data)
    this.check(signal);return result.data
  }
  create(data:Parameters<AIBackend['create']>[0],signal:AbortSignal){return this.call<Receipt>('aiCreateSource',data,signal)}
  complete(sourceId:string,uploadMs:number|undefined,signal:AbortSignal){return this.call<RemoteSource>('aiCompleteSource',{sourceId,...(uploadMs!==undefined?{uploadMs}:{})},signal)}
  retry(sourceId:string,signal:AbortSignal){return this.call<Receipt>('aiRetrySource',{sourceId},signal)}
  get(sourceId:string,signal:AbortSignal){return this.call<RemoteSource>('aiGetSource',{sourceId},signal)}
  async list(context:CourseContext,signal:AbortSignal){
    const items:RemoteSource[]=[];let after:string|undefined;const seen=new Set<string>()
    do{const p=await this.call<{items:RemoteSource[];nextCursor?:string}>('aiListSources',{context,...(after?{after}:{})},signal);items.push(...p.items);after=p.nextCursor;if(after){if(seen.has(after)||seen.size>=100)throw Error('WEB_資料一覧が多いため読み込みを停止しました。');seen.add(after)}}while(after)
    return items
  }
  async evidence(sourceId:string,preview:boolean,signal:AbortSignal){
    let after:string|undefined,page:Evidence|undefined;const chunks:Evidence['items']=[],seen=new Set<string>();const routing:NonNullable<NonNullable<Evidence['recognition']>['routing']>['pages']=[]
    do {const current=await this.call<Evidence>('aiGetEvidence',{sourceId,...(preview?{preview:true}:{}),...(after?{after}:{})},signal)
      if(page && (page.activeVersion!==current.activeVersion || page.previewVersion!==current.previewVersion))throw Error('WEB_資料の版が更新されました。再読み込みしてください。')
      chunks.push(...current.items);routing.push(...current.recognition?.routing?.pages ?? []);page=current;after=current.nextCursor ?? undefined
      if(after){if(seen.has(after)||seen.size>=100)throw Error('WEB_本文が多いため読み込みを停止しました。');seen.add(after)}
    }while(after)
    if(!page)throw Error('WEB_本文を取得できませんでした。')
    if(page.recognition?.routing && preview)page.recognition.routing.pages=routing
    return {...page,items:chunks}
  }
  async delete(sourceId:string,signal:AbortSignal){await this.call('aiDeleteSource',{sourceId},signal)}
  async upload(upload:Upload,file:Blob,signal:AbortSignal,progress:(percent:number)=>void){
    this.check(signal);const url=validateUpload(upload,this.uid)
    await new Promise<void>((resolve,reject)=>{
      const request=new XMLHttpRequest();request.open('PUT',url.toString());request.timeout=180000
      for(const [key,value]of Object.entries(upload.headers ?? {}))request.setRequestHeader(key,value)
      request.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.round(e.loaded/e.total*100))}
      const abort=()=>request.abort(),cleanup=()=>signal.removeEventListener('abort',abort)
      request.onload=()=>{cleanup();request.status>=200&&request.status<300 || request.status===412?resolve():reject(Error('WEB_資料を送信できませんでした。再送してください。'))}
      request.onerror=()=>{cleanup();reject(Error('WEB_送信が中断されました。接続、またはStorageのWeb向けCORS設定を確認してください。'))}
      request.ontimeout=()=>{cleanup();reject(Error('WEB_送信がタイムアウトしました。再送できます。'))}
      request.onabort=()=>{cleanup();reject(new DOMException('Aborted','AbortError'))}
      signal.addEventListener('abort',abort,{once:true});if(signal.aborted){cleanup();reject(signal.reason);return}request.send(file)
    });this.check(signal)
  }
  async chat(request:ChatRequest,signal:AbortSignal,onDelta:(text:string)=>void):Promise<ChatReply>{
    this.check(signal)
    const callable=httpsCallable<ChatRequest,ChatReply,{delta?:string}>(this.functions,'aiChat',{timeout:120000})
    // Do not silently repeat a billable request if a stream fails after admission.
    const {stream,data}=await callable.stream(request,{signal})
    // Attach a rejection handler immediately; the final promise may reject before iteration finishes.
    const completed=data.then(value=>({value}),error=>({error}))
    for await(const chunk of stream){this.check(signal);if(typeof chunk.delta==='string')onDelta(chunk.delta)}
    const final=await completed;if('error'in final)throw final.error;this.check(signal)
    if(typeof final.value.text!=='string'||!final.value.text.trim())throw Error('WEB_AIの最終返信が契約と一致しません。再送は自動では行いません。')
    return final.value
  }
}
