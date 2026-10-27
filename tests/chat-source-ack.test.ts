import test from 'node:test'
import assert from 'node:assert/strict'
import {confirmRequiredSources} from '../src/ai/chat-source-ack.ts'
import type {ChatRequest} from '../src/ai/types.ts'

test('answers require an exact acknowledgement for the newly submitted attachments',()=>{
 const request={requiredSourceIds:['new-a','new-b']} as ChatRequest
 assert.throws(()=>confirmRequiredSources(request,{text:'old server response'}),/確認できません/)
 assert.throws(()=>confirmRequiredSources(request,{text:'partial',includedRequiredSourceIds:['new-a']}),/確認できません/)
 assert.throws(()=>confirmRequiredSources(request,{text:'duplicate',includedRequiredSourceIds:['new-a','new-a']}),/確認できません/)
 assert.doesNotThrow(()=>confirmRequiredSources(request,{text:'ok',includedRequiredSourceIds:['new-b','new-a']}))
 assert.doesNotThrow(()=>confirmRequiredSources({} as ChatRequest,{text:'legacy question without attachment'}))
})
