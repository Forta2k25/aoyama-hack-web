import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {copyAnswer,shareAnswer} from '../src/ai/answer-actions.ts'

const dom=new JSDOM('<!doctype html><button id="focus">元の操作</button>')
const install=(value:object)=>Object.defineProperty(globalThis,'navigator',{value,configurable:true})
test('copy preserves the complete answer as plain text',async()=>{
 const copied:string[]=[];install({clipboard:{writeText:async(text:string)=>{copied.push(text)}}})
 const answer='架空の回答\n\t箇条書き <script>not executable</script>';await copyAnswer(answer);assert.deepEqual(copied,[answer])
})
test('native share exports answer/title only, never the current page or source files; cancellation does not copy',async()=>{
 const data:unknown[]=[],copied:string[]=[];install({clipboard:{writeText:async(text:string)=>{copied.push(text)}},share:async(value:unknown)=>{data.push(value)}})
 assert.equal(await shareAnswer('回答本文','架空授業のAI回答'),'shared');assert.deepEqual(data,[{text:'回答本文',title:'架空授業のAI回答'}]);assert.deepEqual(copied,[])
 install({clipboard:{writeText:async(text:string)=>{copied.push(text)}},share:async()=>{throw new DOMException('cancel','AbortError')}})
 assert.equal(await shareAnswer('回答本文','見出し'),'cancelled');assert.deepEqual(copied,[])
})
test('unsupported native sharing explicitly falls back to copying; real share failures stay failures',async()=>{
 const copied:string[]=[];install({clipboard:{writeText:async(text:string)=>{copied.push(text)}}});assert.equal(await shareAnswer('回答1','見出し'),'copied')
 install({clipboard:{writeText:async(text:string)=>{copied.push(text)}},canShare:()=>false,share:async()=>{throw Error('must not share')}});assert.equal(await shareAnswer('回答2','見出し'),'copied');assert.deepEqual(copied,['回答1','回答2'])
 install({share:async()=>{throw new DOMException('blocked','NotAllowedError')},clipboard:{writeText:async()=>{throw Error('must not copy')}}});await assert.rejects(shareAnswer('回答','見出し'),{name:'NotAllowedError'})
})
test('legacy clipboard fallback restores focus and removes temporary answer text on success/failure',async()=>{
 install({});Object.assign(globalThis,{document:dom.window.document,HTMLElement:dom.window.HTMLElement});const doc=dom.window.document,focus=doc.getElementById('focus')!;focus.focus();let captured=''
 Object.assign(doc,{execCommand:()=>{captured=doc.querySelector('textarea')!.value;return true}});await copyAnswer('回答の全文');assert.equal(captured,'回答の全文');assert.equal(doc.activeElement,focus);assert.equal(doc.querySelectorAll('textarea').length,0)
 Object.assign(doc,{execCommand:()=>false});await assert.rejects(copyAnswer('残してはいけない一時本文'));assert.equal(doc.querySelectorAll('textarea').length,0);assert.equal(doc.activeElement,focus)
})
