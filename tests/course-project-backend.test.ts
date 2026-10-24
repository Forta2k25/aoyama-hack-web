import test,{mock} from 'node:test'
import assert from 'node:assert/strict'
import type {ChatRequest,ProjectReferences} from '../src/ai/types.ts'
let listReply:any={items:[],courseOfferingId:'2026:00004'},chatReply:any,streamCalls=0,requests:any[]=[]
mock.module('../src/firebase.ts',{namedExports:{auth:{app:{},currentUser:{uid:'synthetic-owner'}}}})
mock.module('firebase/functions',{namedExports:{getFunctions:()=>({}),httpsCallable:(_functions:unknown,name:string)=>Object.assign(async(data:any)=>{requests.push({name,data});return {data:listReply}},{stream:async()=>{streamCalls++;return {stream:(async function*(){yield {delta:'未確認の回答'}})(),data:Promise.resolve(chatReply)}}})}})
const {FirebaseAIBackend}=await import('../src/ai/backend.ts')
const context={localCourseId:'fixture',localCourseUUID:'fixture',year:2026,classDocId:'00004',dayID:20000,courseName:'架空授業',teacherName:''}
const request:ChatRequest={context,referenceScope:{protocol:'course-project-v1',mode:'lectures',dayIDs:[20000]},sourceIds:[],turns:[{role:'user',text:'前半の復習'}],mode:'reply'}
const ref=():ProjectReferences=>({protocol:'course-project-v1',courseOfferingId:'2026:00004',scope:request.referenceScope!,targetSources:1,readySources:1,processingSources:0,failedSources:0,partialSources:0,changedSources:0,noTextSources:0,excerpted:false,characters:10,sources:[{sourceId:'source-one',title:'架空資料',dayID:20000,partial:false,locators:[{pageNumber:4}],excerpted:false}]})
test('real Firebase adapter discovers the deployed protocol and requests only caller-owned course sources',async()=>{
 const backend=new FirebaseAIBackend('synthetic-owner');listReply={items:[],courseOfferingId:'2026:00004',inputCapabilities:{courseProject:{protocol:'course-project-v1'}}};await backend.list(context,new AbortController().signal)
 assert.equal(requests.at(-1).data.ownOnly,true);assert.equal(backend.resolvedCourseOfferingId,'2026:00004');assert.equal(backend.projectContextProtocol,'course-project-v1')
 listReply={items:[],courseOfferingId:'2026:00004'};await backend.list(context,new AbortController().signal);assert.equal(backend.projectContextProtocol,undefined)
 streamCalls=0;await assert.rejects(backend.chat(request,new AbortController().signal,()=>{}),/backend/);assert.equal(streamCalls,0)
})
test('old or mixed backend cannot stream an ungrounded project answer; protocol, course and exact date range must be acknowledged',async()=>{
 const backend=new FirebaseAIBackend('synthetic-owner');listReply={items:[],courseOfferingId:'2026:00004',inputCapabilities:{courseProject:{protocol:'course-project-v1'}}};await backend.list(context,new AbortController().signal)
 for(const references of [undefined,{...ref(),courseOfferingId:'2025:00004'},{...ref(),scope:{protocol:'course-project-v1',mode:'course'}},{...ref(),sources:[{...ref().sources[0],dayID:20007}]}]){
  chatReply={text:'範囲未確認の回答',references};let shown='';await assert.rejects(backend.chat(request,new AbortController().signal,s=>shown+=s),/backend/);assert.equal(shown,'')
 }
 chatReply={text:'p.4を参照した完成回答',references:ref()};let shown='';const reply=await backend.chat(request,new AbortController().signal,s=>shown+=s);assert.equal(shown,chatReply.text);assert.equal(reply.references!.sources[0].locators[0].pageNumber,4)
})
