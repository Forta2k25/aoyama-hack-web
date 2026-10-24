// アプリとWebの会話の履歴(文章だけ)を同期する。失敗しても、会話そのものは止めない(次の機会に、もう一度試す)。
import type { AIBackend, CourseContext, Message, RemoteMessage, SyncedMessage } from './types'
import type { AIStore } from './store'
import { courseKey, sessionKey } from './identity'

const attachmentKinds = ['image', 'audio', 'pdf', 'note'] as const

/** 発言の授業日(dayID)。保存先の授業回キー(sessionKey)に入っている。読み取れない古い発言は、同期しない。 */
export function dayIDOf(message: Message): number | undefined {
  try {
    const value = JSON.parse(message.sessionKey ?? '')?.[2]
    return Number.isSafeInteger(value) && value >= 10000 && value <= 50000 ? value : undefined
  } catch { return undefined }
}

/** サーバーへ送る形にする。送れるのは、完了した文章の発言だけ(途中・失敗・中断は送らない)。 */
export function toSyncedMessage(message: Message): SyncedMessage | undefined {
  if (message.state !== 'done' || message.attachmentKind || !message.text.trim()) return undefined
  return { id: message.id, role: message.role, kind: 'text', text: message.text.slice(0, 20000), createdAt: message.createdAt }
}

/** サーバーの発言を、この端末の発言にする。写真などは、本文なしで、種類と枚数だけを持つ。 */
export function fromRemoteMessage(row: RemoteMessage, uid: string, context: CourseContext): Message {
  const dayContext = { ...context, dayID: row.dayID }
  const attachment = (attachmentKinds as readonly string[]).includes(row.kind) ? (row.kind as Message['attachmentKind']) : undefined
  return {
    id: row.id, uid, courseKey: courseKey(context), sessionKey: sessionKey(dayContext), role: row.role,
    text: attachment ? '' : row.text, sourceIds: [], state: 'done', createdAt: row.createdAt, synced: true,
    ...(attachment ? { attachmentKind: attachment, imageCount: row.imageCount } : {}),
  }
}

/**
 * 1回の同期: まだ送っていない自分の発言を送り、サーバーにあって、ここにない発言を取り込む。
 * 取り込んだ発言は、この端末の保存先にも入れる(別の授業回の分も含む)。戻り値は、新しく取り込んだ発言。
 */
// 授業ごとに、取り込みずみの、いちばん新しい発言の時刻。2回目からは、そこから少し戻った所以降だけを取る(通信と読み取りを減らす)。
const cursors = new Map<string, number>()
const OVERLAP_MS = 120_000 // 別の端末の、少し遅れて届いた発言(時計のずれ)も、取りこぼさない

export async function syncConversation(backend: AIBackend, store: AIStore, uid: string, context: CourseContext, signal: AbortSignal): Promise<Message[]> {
  if (!backend.saveMessages || !backend.listMessages) return []
  const key = courseKey(context)
  const local = await store.messages(uid, key)
  const unsent = local.filter(m => !m.synced).map(m => ({ message: m, row: toSyncedMessage(m) })).filter((x): x is { message: Message; row: SyncedMessage } => !!x.row)
  // 同期の途中で、ほかの端末が足した発言を、先に取り込む(送る前に、一覧を取る)。
  const cursorKey = uid + '|' + key, since = cursors.get(cursorKey)
  const remote = await backend.listMessages(context, signal, since === undefined ? undefined : Math.max(since - OVERLAP_MS, 0))
  const known = new Set(local.map(m => m.id))
  const added: Message[] = []
  for (const row of remote) {
    if (known.has(row.id)) continue
    const message = fromRemoteMessage(row, uid, context)
    await store.putMessage(message)
    known.add(row.id); added.push(message)
  }
  const remoteIds = new Set(remote.map(r => r.id))
  // サーバーは、授業回(dayID)ごとに保存する。授業回ごとにまとめて送る。
  const byDay = new Map<number, { message: Message; row: SyncedMessage }[]>()
  for (const item of unsent) {
    const day = dayIDOf(item.message)
    if (day === undefined) continue
    byDay.set(day, [...(byDay.get(day) ?? []), item])
  }
  for (const [day, items] of byDay) {
    const toSend = items.filter(x => !remoteIds.has(x.row.id))
    if (toSend.length) await backend.saveMessages(context.dayID === day ? context : { ...context, dayID: day }, toSend.map(x => x.row), signal)
    for (const { message } of items) { message.synced = true; await store.putMessage(message) }
  }
  const newest = Math.max(0, ...remote.map(r => r.createdAt), ...[...byDay.values()].flat().map(x => x.row.createdAt))
  if (newest > 0) cursors.set(cursorKey, Math.max(cursors.get(cursorKey) ?? 0, newest))
  return added
}
