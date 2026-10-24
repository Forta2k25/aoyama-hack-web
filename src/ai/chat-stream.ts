import type {ChatReply,ChatRequest,ChatProgress} from './types'
export const CHAT_RESUME_PROTOCOL='chat-resume-v1'
export interface CallableStream {stream:AsyncIterable<{delta?:string;protocol?:string;status?:string;retryCount?:number;continuationCount?:number}>;data:Promise<ChatReply>}
export class ChatStreamError extends Error {readonly original:unknown;readonly canResume:boolean;readonly request:ChatRequest;constructor(original:unknown,canResume:boolean,request:ChatRequest){super('CHAT_STREAM_INTERRUPTED');this.original=original;this.canResume=canResume;this.request=request}}
export function retryableChatError(error:unknown){
 const e=error as {name?:string;code?:string;details?:{code?:string;retryable?:boolean}}
 const code=e?.details?.code||e?.code||''
 if(/unauthenticated|permission-denied|invalid-argument|cancelled|AUTH_CHANGED|CHAT_PROVIDER_AUTH|CHAT_INVALID_REQUEST|CHAT_MODEL_MISMATCH|CHAT_STREAM_MALFORMED|CHAT_FINISH_/.test(code))return false
 if(e?.details?.retryable!==undefined)return e.details.retryable
 return e instanceof TypeError||/unavailable|deadline-exceeded|network|internal|unknown/.test(code)||e?.name==='TimeoutError'
}
const pause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{signal.throwIfAborted();const finish=()=>{signal.removeEventListener('abort',stop);resolve()},timer=setTimeout(finish,ms),stop=()=>{clearTimeout(timer);reject(signal.reason)};signal.addEventListener('abort',stop,{once:true})})

function finalResult<T>(value:Promise<T>,signal:AbortSignal,ms:number):Promise<T>{return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{cleanup();reject(Object.assign(Error('Missing final callable event'),{code:'functions/unavailable'}))},ms),abort=()=>{cleanup();reject(signal.reason)},cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort)}
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return}value.then(x=>{cleanup();resolve(x)},e=>{cleanup();reject(e)})
})}

/** Retry only after the server explicitly advertises resumable generation. Never blindly repeat an old billable API. */
export async function receiveChat(request:ChatRequest,signal:AbortSignal,delta:(s:string)=>void,progress:(p:ChatProgress)=>void,open:(r:ChatRequest,s:AbortSignal)=>Promise<CallableStream>,options:{sleep?:(ms:number,s:AbortSignal)=>Promise<void>;finalMs?:number;requestMs?:number;log?:(x:Record<string,unknown>)=>void}={}):Promise<ChatReply>{
 let partial=request.resume?.partial||'',supported=!!request.resume,retries=0,chunkCount=0;const started=Date.now()
 for(;;){
  signal.throwIfAborted()
  if(Date.now()-started>=240000)throw new ChatStreamError(Object.assign(Error('Recovery deadline'),{code:'functions/deadline-exceeded'}),supported&&!!partial,request)
  const attemptSignal=AbortSignal.any([signal,AbortSignal.timeout(Math.min(options.requestMs??120000,240000-(Date.now()-started)))])
  const current:ChatRequest={...request,streamProtocol:CHAT_RESUME_PROTOCOL,...(partial?{resume:{protocol:CHAT_RESUME_PROTOCOL,partial}}:{})}
  try{
   const call=await open(current,attemptSignal),final=call.data.then(value=>({value}),error=>({error}));let streamError:unknown
   try{for await(const chunk of call.stream){signal.throwIfAborted();if(chunk.protocol===CHAT_RESUME_PROTOCOL)supported=true;if(['generating','continuing','retrying'].includes(chunk.status||''))progress({status:chunk.status as ChatProgress['status'],supported,retryCount:chunk.retryCount,continuationCount:chunk.continuationCount});if(typeof chunk.delta==='string'){chunkCount++;partial+=chunk.delta;if(partial.length>24000)throw Object.assign(Error('Output limit'),{code:'CHAT_OUTPUT_LIMIT'});delta(chunk.delta)}}}catch(e){streamError=e}
   // A transport may throw while the SDK's final promise never settles. Its rejection is handled above;
   // do not await that promise on the failed-stream path and deadlock recovery.
   if(streamError)throw streamError
   const done=await finalResult(final,attemptSignal,options.finalMs??3000);signal.throwIfAborted();if('error'in done)throw done.error
   if(typeof done.value.text!=='string'||!done.value.text.trim())throw Object.assign(Error('Invalid final result'),{code:'CHAT_STREAM_MALFORMED'})
   options.log?.({event:'web_chat_stream',requestId:request.requestId,generationId:request.generationId,elapsedMs:Date.now()-started,chunkCount,outputChars:done.value.text.length,retryCount:retries,finishReason:'COMPLETE'})
   return retries||request.resume?{...done.value,recognition:done.value.recognition?{...done.value.recognition,inputTokens:null,outputTokens:null,totalTokens:null,estimatedCostUSD:null}:undefined}:done.value
  }catch(caught){
   const error=attemptSignal.aborted&&!signal.aborted?Object.assign(Error('Stream deadline'),{code:'functions/deadline-exceeded'}):caught
   if(signal.aborted)throw new ChatStreamError(error,supported&&!!partial,request)
   const allowed=retryableChatError(error),details=(error as {details?:{stream?:{protocol?:string}}})?.details
   if(details?.stream?.protocol===CHAT_RESUME_PROTOCOL)supported=true
   const serverLimit=/CHAT_(?:RETRY_EXHAUSTED|OUTPUT_LIMIT|CONTINUATION_LIMIT|GENERATION_DEADLINE)/.test((error as {details?:{code?:string}})?.details?.code||'')
   if(!allowed||!supported||serverLimit||retries>=2){options.log?.({event:'web_chat_stream',requestId:request.requestId,generationId:request.generationId,elapsedMs:Date.now()-started,chunkCount,outputChars:partial.length,retryCount:retries,errorCode:allowed?'RECOVERY_EXHAUSTED':'NON_RETRYABLE'});throw new ChatStreamError(error,allowed&&supported&&!!partial,request)}
   progress({status:'retrying',supported,retryCount:retries+1});try{await(options.sleep||pause)([500,1500][retries++],signal)}catch(e){throw new ChatStreamError(e,supported&&!!partial,request)}
  }
 }
}
