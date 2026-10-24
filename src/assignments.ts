// 課題。アプリが userAssignments/{uid}(AI用データベース)に置いた、Moodleの予定・自分で足した課題・提出済みを、Webで見る。
// 提出済みの印は、配列の追加・削除で書く(アプリ側の印と、混ざらない)。
import { getFirestore, doc, onSnapshot, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { auth } from './firebase'

export interface AssignmentItem {
  uid: string
  title: string
  course: string
  type: string
  custom: boolean
  due: number | null
  url?: string
}
export interface AssignmentState { items: AssignmentItem[]; submitted: Set<string> }

const ref = (uid: string) => doc(getFirestore(auth.app, 'aogaku-ai'), 'userAssignments', uid)

export function parseAssignments(data: Record<string, unknown> | undefined): AssignmentState {
  const items: AssignmentItem[] = []
  for (const raw of Array.isArray(data?.['events']) ? (data!['events'] as Record<string, unknown>[]) : []) {
    if (typeof raw?.['uid'] !== 'string' || typeof raw['title'] !== 'string') continue
    items.push({
      uid: raw['uid'], title: raw['title'], course: typeof raw['course'] === 'string' ? raw['course'] : '',
      type: typeof raw['type'] === 'string' ? raw['type'] : 'other', custom: raw['custom'] === true,
      due: typeof raw['due'] === 'number' ? raw['due'] : null, url: typeof raw['url'] === 'string' && /^https?:\/\//.test(raw['url']) ? raw['url'] : undefined,
    })
  }
  items.sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity))
  const submitted = new Set(Array.isArray(data?.['submitted']) ? (data!['submitted'] as unknown[]).filter((x): x is string => typeof x === 'string') : [])
  return { items, submitted }
}

const DAY = ['日', '月', '火', '水', '木', '金', '土']
export const dayLabel = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${DAY[d.getDay()]})` }
export const timeLabel = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

/** 今後(期限が来ていない)を日付ごとに、期限切れは新しい順に、分ける */
export function groupAssignments(items: AssignmentItem[], now = Date.now()): { upcoming: { label: string; items: AssignmentItem[] }[]; past: AssignmentItem[] } {
  const upcoming: { label: string; items: AssignmentItem[] }[] = []
  const past: AssignmentItem[] = []
  for (const it of items) {
    if (it.due !== null && it.due < now) { past.push(it); continue }
    const label = it.due === null ? '期限なし' : dayLabel(it.due)
    const last = upcoming[upcoming.length - 1]
    if (last && last.label === label) last.items.push(it)
    else upcoming.push({ label, items: [it] })
  }
  past.sort((a, b) => (b.due ?? 0) - (a.due ?? 0))
  return { upcoming, past }
}

export function subscribeAssignments(uid: string, onState: (s: AssignmentState | null) => void, onError: () => void): () => void {
  return onSnapshot(ref(uid), (snap) => onState(snap.exists() ? parseAssignments(snap.data()) : null), onError)
}

export async function setSubmitted(uid: string, itemUid: string, submitted: boolean): Promise<void> {
  await setDoc(ref(uid), { submitted: submitted ? arrayUnion(itemUid) : arrayRemove(itemUid), webUpdatedAt: new Date() }, { merge: true })
}
