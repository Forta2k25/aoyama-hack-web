import type {ChatReply, ChatRequest} from './types'

/** Never expose a streamed answer until the server confirms each submitted attachment was used. */
export function confirmRequiredSources(request:ChatRequest, result:ChatReply):void {
  const required=request.requiredSourceIds??[]
  if(!required.length)return
  const included=result.includedRequiredSourceIds
  if(!Array.isArray(included)||included.length!==required.length||new Set(included).size!==included.length||required.some(id=>!included.includes(id)))
    throw Error('WEB_添付資料を回答に含めたことを確認できませんでした。接続先の更新後にもう一度送信してください。')
}
