import type { EvidenceChunk, Recognition, SourceKind } from './types'
import { estimatedCostText, costDisplay } from './cost'
export function evidenceText(chunks: EvidenceChunk[]): string {
  let result = '', key = '', end: number | undefined
  for (const c of [...chunks].sort((a,b) => a.chunkId.localeCompare(b.chunkId))) {
    const next = `${c.unitIndex ?? ''}:${c.locator.pageNumber ?? ''}:${c.locator.imageIndex ?? ''}:${c.locator.startSeconds ?? ''}`
    if (next !== key || !result) {
      result += (result ? '\n\n' : '') + (c.locator.pageNumber ? `[p.${c.locator.pageNumber}]\n` : '')
      if (c.locator.startSeconds !== undefined) result += `[${c.locator.startSeconds}秒〜${c.locator.endSeconds ?? '?'}秒]\n`
      result += c.text; key = next; end = c.locator.endChar
    } else {
      let overlap = c.locator.startChar !== undefined && end !== undefined ? Math.max(0, end-c.locator.startChar) : 0
      if(c.locator.startChar===undefined||end===undefined){for(let n=Math.min(200,result.length,c.text.length);n>0;n--)if(result.endsWith(c.text.slice(0,n))){overlap=n;break}}
      result += c.text.slice(overlap); end = c.locator.endChar ?? end
    }
  }
  return result
}
export function metadataText(r?: Recognition | null): string {
  if (!r) return 'モデル・usage情報は未取得です。'
  const rows = [r.provider, r.model].filter(Boolean).join(' / ')
  const tokens = r.method === 'groq_asr' ? '音声認識はtoken課金ではないため対象外' :
    r.totalTokens != null ? `入力 ${r.inputTokens != null ? r.inputTokens.toLocaleString() : '未取得'} / 出力 ${r.outputTokens != null ? r.outputTokens.toLocaleString() : '未取得'} / 合計 ${r.totalTokens.toLocaleString()} tokens` : 'usage未取得'
  const price = estimatedCostText(r.estimatedCostUSD)
  return [rows, r.audioDurationSeconds!=null?`音声 ${r.audioDurationSeconds.toFixed(1)} 秒`:'', r.processingMs!=null?`処理 ${(r.processingMs/1000).toFixed(2)} 秒`:'', tokens, price, r.pricingAsOf?`料金基準: ${r.pricingAsOf}`:''].filter(Boolean).join('\n')
}
/** 「AIに質問する」の全画面チャット用。返信までの時間・token・金額だけを、1行で見せる。 */
export function compactMetadataText(r?: Recognition | null): string {
  if (!r) return ''
  const parts: string[] = []
  if (r.processingMs != null) parts.push(`${(r.processingMs / 1000).toFixed(1)}秒`)
  if (r.totalTokens != null) parts.push(`${r.totalTokens.toLocaleString()} tokens`)
  if (r.estimatedCostUSD != null && Number.isFinite(r.estimatedCostUSD) && r.estimatedCostUSD >= 0) {
    const yen = r.estimatedCostUSD * costDisplay.usdToJpy
    parts.push(yen > 0 && yen < 0.0001 ? '¥0.0001未満' : `¥${yen.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: yen < 1 ? 4 : 2 })}`)
  }
  return parts.join(' · ')
}
export const statusLabel: Record<string,string> = { local:'未送信', uploading:'送信中', awaiting_upload:'送信待ち', queued:'解析待ち', extracting:'解析中', indexing:'保存中', processing:'解析中', ready:'完了', partial_ready:'部分完了', failed:'再試行できます', deleting:'削除中', deleted:'削除済み' }
export function fileKind(file: File): SourceKind {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (/^image\/(jpeg|png|webp|heic(?:-sequence)?|heif(?:-sequence)?)$/.test(file.type) || /\.(jpg|jpeg|png|webp|heic|heif)$/.test(name)) return 'image'
  if (/\.m4a$/.test(name) || /^audio\/(mp4|x-m4a)$/.test(file.type)) return 'audio'
  if (/^audio\//.test(file.type)||/\.(mp3|wav|webm|aiff|ogg)$/.test(name))throw Error('WEB_本番AIで受け付ける音声はm4aです。m4aへ変換してから追加してください。')
  throw Error('写真（JPEG・PNG等）、PDF、Word(.docx)、m4aを選んでください。')
}
export function mimeFor(file: File, type: SourceKind): string {
  if (type === 'pdf') return 'application/pdf'
  if (type === 'audio') return 'audio/mp4'
  return file.type || (/\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : /\.hei[cf]$/i.test(file.name) ? 'image/heic' : 'image/jpeg')
}
export function safeError(error: unknown): string {
  const code = (error as { details?: {code?:string}; code?:string })?.details?.code ?? (error as {code?:string})?.code ?? ''
  if (code === 'AI_INPUT_NOT_ENABLED') return 'このアカウントはAIの内部テスト対象ではありません。許可リストは変更していません。'
  if (/unauthenticated|AUTH_CHANGED/i.test(code)) return 'ログイン状態が変わりました。ログインし直してください。'
  if (code==='CHAT_INVALID_RESULT') return '回答の完了を確認できませんでした。'
  if (/CHAT_OUTPUT_LIMIT|CHAT_CONTINUATION_LIMIT/.test(code)) return '長さの上限に達したため、回答生成を途中で区切りました。'
  if (/CHAT_RETRY_EXHAUSTED|CHAT_STREAM_TRUNCATED|CHAT_UNAVAILABLE|CHAT_GENERATION_DEADLINE/.test(code)) return '一時的な切断で回答が途中までになりました。'
  if (/CHAT_PROVIDER_AUTH|CHAT_INVALID_REQUEST|CHAT_STREAM_MALFORMED|CHAT_MODEL_MISMATCH|CHAT_FINISH_/.test(code)) return '再試行できないエラーのため回答生成を停止しました。'
  if (/not-found/.test(code)) return '接続先にAIチャットAPIが未導入です。資料の読み取り結果は下の「本文」で確認できます。'
  if (/resource-exhausted|RATE_LIMIT|QUOTA/.test(code)) return '利用上限または一時的な混雑です。時間を置いて再試行してください。'
  if (error instanceof Error && error.name === 'AbortError') return '中断しました。資料は再送できます。'
  if (error instanceof Error && error.message.startsWith('WEB_')) return error.message.slice(4)
  if (/PROJECT_SCOPE_TOO_LARGE/.test(code)) return '参照する資料が多いため、授業回の範囲を絞ってください。対象を勝手に省略せず停止しました。'
  if (/PROJECT_NO_READY_MATERIAL/.test(code)) return '選んだ授業回の範囲に、参照できる解析完了の資料がありません。'
  if (/PROJECT_COURSE_MISMATCH/.test(code)) return '資料の授業識別情報が一致しません。時間割から授業を開き直してください。'
  const diagnostic=typeof code==='string'&&code.length<=64&&(/^(?:AI_|INVALID_|UNSUPPORTED_|UPLOAD_|PROVIDER_|AUDIO_|SOURCE_|STORAGE_|INPUT_|PDF_|IMAGE_|DURATION_|MIME_)[A-Z0-9_]+$/.test(code)||/^(?:functions\/)?(?:invalid-argument|permission-denied|internal|unavailable|deadline-exceeded|failed-precondition|unknown)$/.test(code))?`（${code}）`:''
  return `処理に失敗しました。接続を確認して再試行してください。${diagnostic}`
}
