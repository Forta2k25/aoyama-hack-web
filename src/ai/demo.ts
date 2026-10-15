import type { AIBackend, ChatRequest, CourseContext, Evidence, Receipt, RemoteSource, SourceKind, Upload } from './types'
const pause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{signal.throwIfAborted();const done=()=>{signal.removeEventListener('abort',stop);resolve()},timer=setTimeout(done,ms),stop=()=>{clearTimeout(timer);reject(signal.reason)};signal.addEventListener('abort',stop,{once:true})})
export class DemoAIBackend implements AIBackend {
  readonly demo=true
  private sources=new Map<string,{source:RemoteSource;start:number;text:string}>()
  constructor(initial:{source:RemoteSource;text?:string}[]=[]){for(const {source,text} of initial)this.sources.set(source.sourceId,{source,start:Date.now()-12000,text:text ?? 'デバッグ用に保存した架空の資料です。'})}
  async create(data:{type:SourceKind;title:string;context:CourseContext;text?:string}){
    const source:RemoteSource={sourceId:crypto.randomUUID(),sourceType:data.type,title:data.title,status:'queued',courseOfferingId:`${data.context.year}:${data.context.classDocId}`,pipelineVersion:data.type==='image'?'image-auto-v1':data.type==='pdf'?'pdf-auto-v1':data.type==='audio'?'audio-groq-v2':'input-v1'}
    this.sources.set(source.sourceId,{source,start:Date.now(),text:data.text ?? '架空の講義資料：観察から問いを立て、仮説を検証する。'})
    return source as Receipt
  }
  async complete(id:string){return this.get(id)}
  async retry(id:string){const row=this.sources.get(id)!;row.start=Date.now();return this.get(id)}
  async get(id:string){
    const row=this.sources.get(id);if(!row)throw Error('WEB_資料がありません。')
    const elapsed=Date.now()-row.start,ready=elapsed>6500
    row.source={...row.source,status:ready?'ready':'extracting',previewVersion:!ready&&row.source.sourceType==='pdf'?'demo-preview':null,previewProgress:row.source.sourceType==='pdf'?{completed:elapsed>1800?1:0,total:3}:undefined,recognition:ready?{provider:'demo',model:'架空のデバッグ応答（API呼び出しなし）',method:row.source.sourceType==='audio'?'groq_asr':'multimodal_ai',totalTokens:0,estimatedCostUSD:0}:null,latency:ready?{version:'visual-latency-v1',totalProcessingMs:6500}:null}
    return structuredClone(row.source)
  }
  async list(){return [...this.sources.values()].map(x=>structuredClone(x.source))}
  async evidence(id:string,preview:boolean):Promise<Evidence>{
    const source=await this.get(id),row=this.sources.get(id)!,text=row.text
    const items=source.status==='ready'?[{chunkId:'0001',text,method:'multimodal_ai',locator:{pageNumber:source.sourceType==='pdf'?1:undefined}}]:preview&&source.previewProgress!.completed?[{chunkId:'0001',text:'これは途中結果です。ページ1：観察と仮説。',method:'native_text',locator:{pageNumber:1}}]:[]
    return {items,status:source.status,preview,previewVersion:source.previewVersion,progress:source.previewProgress,pipelineVersion:source.pipelineVersion,recognition:source.recognition,latency:source.latency}
  }
  async delete(id:string){this.sources.delete(id)}
  async upload(_upload:Upload,_file:Blob,_signal:AbortSignal,progress:(n:number)=>void){progress(100)}
  async chat(request:ChatRequest,signal:AbortSignal,delta:(text:string)=>void){
    const text=request.mode==='intro'?'【デバッグ用の架空の返信】資料を受け取りました。要約したり、気になる点を質問したりできます。どのように使いますか？':`【デバッグ用の架空の返信】「${request.turns.at(-1)?.text}」を受け取りました。\n\n本番の返信では、選択した資料の読み取り結果を根拠に回答します。この画面はUI確認用で、外部AI・Firebaseへの送信はありません。`
    for(const part of text.match(/.{1,5}|\n/g) ?? []){await pause(35,signal);delta(part)}
    return {text,recognition:{provider:'demo',model:'外部AI未使用',totalTokens:0,estimatedCostUSD:0}}
  }
}
