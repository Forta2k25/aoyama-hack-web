import type {LocalMaterial} from './types'

export interface MaterialProgress {
  label:string
  progress?:{value?:number;max:number;description:string}
}
/** Progress comes only from upload bytes or completed backend pages, never elapsed-time estimates. */
export function materialProgress(row:LocalMaterial,uploadPercent?:number):MaterialProgress {
  if(row.state==='ready')return {label:`✓ ${row.type==='note'?'保存':'アップロード'}・${row.remote?.status==='partial_ready'?'一部解析完了':'解析完了'}`}
  if(row.state==='failed')return {label:`送信/解析失敗・再送できます${row.error?`（${row.error}）`:''}`}
  if(row.state==='uploading'){
    const value=typeof uploadPercent==='number'&&Number.isFinite(uploadPercent)&&uploadPercent>=0&&uploadPercent<=100?uploadPercent:undefined
    return {label:value===undefined?'送信準備中…':`アップロード中 ${value}%`,progress:{value,max:100,description:'資料のアップロード進捗'}}
  }
  if(row.state==='local')return {label:'端末に保存済み・送信待ち',progress:{max:100,description:'資料の送信準備中'}}
  if(row.state==='processing'){
    const status=row.remote?.status
    if(status==='awaiting_upload')return {label:'アップロード未完了・再送できます'}
    const phase=status==='queued'?'解析待ち':status==='extracting'?'解析中':status==='indexing'?'解析結果を保存中':'送信状況を確認中…'
    const saved=['queued','extracting','indexing'].includes(status??'')?`${row.type==='note'?'保存済み':'✓ アップロード済み'}・`:''
    const p=row.remote?.previewProgress
    if(row.type==='pdf'&&p&&Number.isInteger(p.completed)&&Number.isInteger(p.total)&&p.total>0&&p.completed>=0&&p.completed<=p.total){
      const description=`${phase}・${p.completed}/${p.total}ページ解析済み（${Math.floor(p.completed/p.total*100)}%）`
      return {label:saved+description,progress:{value:p.completed,max:p.total,description}}
    }
    return {label:saved+phase+'（進捗率未取得）',progress:{max:100,description:phase+'・進捗率は未取得です'}}
  }
  return {label:'削除中'}
}
