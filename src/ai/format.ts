import type { EvidenceChunk, Recognition, SourceKind } from './types'
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
  const price = r.estimatedCostUSD != null ? `推定 $${r.estimatedCostUSD.toFixed(6)}（実際の請求額とは異なります）` : '推定コスト未取得'
  return [rows, r.audioDurationSeconds!=null?`音声 ${r.audioDurationSeconds.toFixed(1)} 秒`:'', r.processingMs!=null?`処理 ${(r.processingMs/1000).toFixed(2)} 秒`:'', tokens, price, r.pricingAsOf?`料金基準: ${r.pricingAsOf}`:''].filter(Boolean).join('\n')
}
export const statusLabel: Record<string,string> = { local:'未送信', uploading:'送信中', awaiting_upload:'送信待ち', queued:'解析待ち', extracting:'解析中', indexing:'保存中', processing:'解析中', ready:'完了', partial_ready:'部分完了', failed:'再試行できます', deleting:'削除中', deleted:'削除済み' }
export function fileKind(file: File): SourceKind {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || /\.(jpg|jpeg|png|webp|heic|heif)$/.test(name)) return 'image'
  if (/\.(m4a|mp3|wav)$/.test(name) || /^audio\/(mp4|mpeg|wav|x-wav|x-m4a)$/.test(file.type)) return 'audio'
  throw Error('写真（JPEG・PNG等）、PDF、m4a・mp3・wavを選んでください。')
}
export function mimeFor(file: File, type: SourceKind): string {
  if (type === 'pdf') return 'application/pdf'
  if (type === 'audio') return file.name.endsWith('.wav') ? 'audio/wav' : file.name.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4'
  return file.type || (/\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : /\.hei[cf]$/i.test(file.name) ? 'image/heic' : 'image/jpeg')
}
export function safeError(error: unknown): string {
  const code = (error as { details?: {code?:string}; code?:string })?.details?.code ?? (error as {code?:string})?.code ?? ''
  if (code === 'AI_INPUT_NOT_ENABLED') return 'このアカウントはAIの内部テスト対象ではありません。許可リストは変更していません。'
  if (/unauthenticated|AUTH_CHANGED/i.test(code)) return 'ログイン状態が変わりました。ログインし直してください。'
  if (/not-found/.test(code)) return '接続先にAIチャットAPIが未導入です。資料の読み取り結果は下の「本文」で確認できます。'
  if (/resource-exhausted|RATE_LIMIT|QUOTA/.test(code)) return '利用上限または一時的な混雑です。時間を置いて再試行してください。'
  if (error instanceof Error && error.name === 'AbortError') return '中断しました。資料は再送できます。'
  if (error instanceof Error && error.message.startsWith('WEB_')) return error.message.slice(4)
  return '処理に失敗しました。接続を確認して再試行してください。'
}
