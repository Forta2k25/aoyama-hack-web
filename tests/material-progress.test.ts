import test from 'node:test'
import assert from 'node:assert/strict'
import {materialProgress} from '../src/ai/material-progress.ts'
import type {LocalMaterial,SourceStatus} from '../src/ai/types.ts'

function row(status:SourceStatus,type:LocalMaterial['type']='pdf'):LocalMaterial{return {id:'fixture',uid:'synthetic-owner',courseKey:'2026:00004',context:{} as LocalMaterial['context'],clientRequestId:'fixture-request',type,title:'架空資料',mime:'application/pdf',size:1,state:'processing',createdAt:0,remote:{sourceId:'fixture-source',sourceType:type,title:'架空資料',status,courseOfferingId:'2026:00004'}}}
test('analysis progress uses completed pages only, separates queue/extraction/final persistence and never claims ready at 100%',()=>{
 const r=row('queued');assert.match(materialProgress(r).label,/解析待ち/);assert.equal(materialProgress(r).progress?.value,undefined)
 r.remote!.status='extracting';r.remote!.previewProgress={completed:12,total:30};const p=materialProgress(r);assert.match(p.label,/12\/30ページ解析済み（40%）/);assert.deepEqual(p.progress,{value:12,max:30,description:'解析中・12/30ページ解析済み（40%）'})
 r.remote!.status='indexing';r.remote!.previewProgress={completed:30,total:30};assert.match(materialProgress(r).label,/解析結果を保存中/);assert(!materialProgress(r).label.includes('解析完了'))
 r.state='ready';r.remote!.status='ready';assert.match(materialProgress(r).label,/解析完了/);assert.equal(materialProgress(r).progress,undefined)
})
test('unknown/invalid counts and single-image processing stay indeterminate; upload percentage remains separate',()=>{
 const r=row('extracting');for(const p of [undefined,{completed:1,total:0},{completed:4,total:3},{completed:-1,total:3},{completed:1.2,total:3}]){r.remote!.previewProgress=p;assert.equal(materialProgress(r).progress?.value,undefined);assert(!materialProgress(r).label.includes('%'))}
 r.type='image';r.remote!.previewProgress={completed:1,total:3};assert.equal(materialProgress(r).progress?.value,undefined)
 r.state='uploading';assert.equal(materialProgress(r,37).progress?.value,37);assert.match(materialProgress(r,37).label,/アップロード中 37%/);assert.equal(materialProgress(r,NaN).progress?.value,undefined)
 r.state='processing';r.remote!.status='awaiting_upload';assert.match(materialProgress(r).label,/アップロード未完了/);assert.equal(materialProgress(r).progress,undefined)
 r.state='failed';assert.equal(materialProgress(r).progress,undefined);assert.match(materialProgress(r).label,/失敗/)
})
