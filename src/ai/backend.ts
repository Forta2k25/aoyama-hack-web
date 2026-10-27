import {receiveChat} from './chat-stream'
import {confirmRequiredSources} from './chat-source-ack'
import { validateUpload } from './upload'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth } from '../firebase'
import type { AIBackend, ChatReply, ChatRequest, ChatProgress, CourseContext, Evidence, Receipt, RemoteMessage, RemoteSource, SyncedMessage, Upload } from './types'

const callableNames = new Set(['aiCreateSource','aiCompleteSource','aiRetrySource','aiGetSource','aiListSources','aiGetEvidence','aiDeleteSource','aiChat','aiSaveMessages','aiListMessages'])
export class FirebaseAIBackend implements AIBackend {
  readonly demo=false
  projectContextProtocol?:string
  resolvedCourseOfferingId?:string
  /** 会話の保存先の授業ID(aiListMessages が返す)。リアルタイムの購読に使う */
  messagesOfferingId?:string
  private readonly functions=getFunctions(auth.app,'asia-northeast1')
  private readonly uid:string
  constructor(uid:string) {this.uid=uid}
  private check(signal:AbortSignal){signal.throwIfAborted();if(auth.currentUser?.uid!==this.uid)throw Object.assign(Error('Auth changed'),{code:'AUTH_CHANGED'})}
  private async call<T>(name:string,data:unknown,signal:AbortSignal):Promise<T> {
    this.check(signal);if(!callableNames.has(name))throw Error('Unsupported callable')
    const result=await httpsCallable<unknown,T>(this.functions,name,{timeout:120000})(data)
    this.check(signal);return result.data
  }
  async saveMessages(context:CourseContext,rows:SyncedMessage[],signal:AbortSignal){
    for(let i=0;i<rows.length;i+=50)await this.call('aiSaveMessages',{context,messages:rows.slice(i,i+50)},signal)
  }
  async listMessages(context:CourseContext,signal:AbortSignal,since?:number){
    const items:RemoteMessage[]=[];let after:number|null|undefined=since;const seen=new Set<number>()
    do{const page:{items:RemoteMessage[];nextCursor:number|null;courseOfferingId?:string}=await this.call<{items:RemoteMessage[];nextCursor:number|null;courseOfferingId?:string}>('aiListMessages',{context,...(after!==undefined&&after!==null?{after}:{})},signal)
      if(page.courseOfferingId)this.messagesOfferingId=page.courseOfferingId
      items.push(...page.items);after=page.nextCursor;if(after!==null&&after!==undefined){if(seen.has(after)||seen.size>=50)break;seen.add(after)}}while(after!==null&&after!==undefined)
    return items
  }
  create(data:Parameters<AIBackend['create']>[0],signal:AbortSignal){return this.call<Receipt>('aiCreateSource',data,signal)}
  complete(sourceId:string,uploadMs:number|undefined,signal:AbortSignal){return this.call<RemoteSource>('aiCompleteSource',{sourceId,...(uploadMs!==undefined?{uploadMs}:{})},signal)}
  retry(sourceId:string,signal:AbortSignal){return this.call<Receipt>('aiRetrySource',{sourceId},signal)}
  get(sourceId:string,signal:AbortSignal){return this.call<RemoteSource>('aiGetSource',{sourceId},signal)}
  async list(context:CourseContext,signal:AbortSignal){
    const items:RemoteSource[]=[];let after:string|undefined;const seen=new Set<string>()
    this.projectContextProtocol=undefined;this.resolvedCourseOfferingId=undefined
    do{const p=await this.call<{items:RemoteSource[];courseOfferingId?:string;inputCapabilities?:{courseProject?:{protocol?:string}};nextCursor?:string}>('aiListSources',{context,ownOnly:true,...(after?{after}:{})},signal)
      if(this.resolvedCourseOfferingId&&p.courseOfferingId!==this.resolvedCourseOfferingId)throw Error('WEB_資料一覧の授業が途中で変わりました。開き直してください。')
      this.resolvedCourseOfferingId=p.courseOfferingId
      if(p.inputCapabilities?.courseProject?.protocol==='course-project-v1')this.projectContextProtocol='course-project-v1'
      items.push(...p.items);after=p.nextCursor;if(after){if(seen.has(after)||seen.size>=100)throw Error('WEB_資料一覧が多いため読み込みを停止しました。');seen.add(after)}}while(after)
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
  async chat(request:ChatRequest,signal:AbortSignal,onDelta:(text:string)=>void,onProgress:(p:ChatProgress)=>void=()=>{}):Promise<ChatReply>{
    this.check(signal)
    if(request.referenceScope&&this.projectContextProtocol!=='course-project-v1')throw Error('WEB_授業横断の参照には対応backendの更新が必要です。')
    const callable=httpsCallable<ChatRequest,ChatReply,{delta?:string;protocol?:string;status?:string}>(this.functions,'aiChat',{timeout:120000})
    // A mixed/old backend must not silently answer without the project materials. Verify the final acknowledgement before showing project text.
    const result=await receiveChat(request,signal,text=>{this.check(signal);if(!request.referenceScope&&!request.requiredSourceIds?.length)onDelta(text)},progress=>{this.check(signal);onProgress(progress)},async(data,active)=>{this.check(active);const result=await callable.stream(data,{signal:active});this.check(active);return result},{log:record=>console.info(record)})
    if(request.requiredSourceIds?.length){confirmRequiredSources(request,result);onDelta(result.text)}
    if(request.referenceScope){const ref=result.references;if(ref?.protocol!=='course-project-v1'||ref.courseOfferingId!==this.resolvedCourseOfferingId||ref.scope.mode!==request.referenceScope.mode||JSON.stringify(ref.scope.dayIDs??[])!==JSON.stringify(request.referenceScope.dayIDs??[])||!ref.sources.length||ref.sources.some(s=>request.referenceScope!.mode==='lectures'&&!request.referenceScope!.dayIDs!.includes(s.dayID!)))throw Error('WEB_授業横断の参照をbackendが確認できませんでした。更新完了後に開き直してください。');onDelta(result.text)}
    this.check(signal);return result
  }
}
