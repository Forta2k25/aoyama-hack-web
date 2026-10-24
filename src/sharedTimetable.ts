// 時間割の共有URL。持ち主が、時間割のコピーを「推測できない長いID」で公開用の置き場に保存し、そのURLを友達に送る。
// 置き場は AI用データベース(aogaku-ai)の sharedTimetables。ルールは Config/AI/firestore.rules(IDを知っている人だけ1件読める)。
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { auth } from './firebase'
import type { TimetableSlot } from './timetable'

export interface SharedCell { d: number; p: number; t: string; r: string; k?: string }
export interface SharedTimetable {
  ownerUid: string
  ownerName: string
  termLabel: string
  periods: number
  saturday: boolean
  cells: SharedCell[]
}

const sharedDb = () => getFirestore(auth.app, 'aogaku-ai')
const idKey = (uid: string, term: string) => `aoyama-hack.share-id.v1.${uid}.${term}`

export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function storedShareId(uid: string, term: string): string | null {
  try { return localStorage.getItem(idKey(uid, term)) } catch { return null }
}

export function shareUrl(id: string): string {
  return `${location.origin}/t/${id}`
}

export function buildSharedTimetable(ownerUid: string, ownerName: string, termLabel: string, slots: TimetableSlot[], periods: number, saturday: boolean): SharedTimetable {
  const cells = slots.map((s) => ({ d: s.day, p: s.period, t: s.course.title, r: s.course.room ?? '', ...(s.course.colorKey ? { k: s.course.colorKey } : {}) }))
  return {
    ownerUid, ownerName, termLabel, cells,
    periods: Math.max(periods, ...slots.map((s) => s.period)),
    saturday: saturday || slots.some((s) => s.day === 5),
  }
}

/** 共有する(すでにURLがあれば、同じURLの中身を、いまの時間割に更新する) */
export async function publishShare(term: string, data: SharedTimetable): Promise<string> {
  const id = storedShareId(data.ownerUid, term) ?? newShareId()
  await setDoc(doc(sharedDb(), 'sharedTimetables', id), { ...data, updatedAt: serverTimestamp() })
  try { localStorage.setItem(idKey(data.ownerUid, term), id) } catch { /* 保存できなくても、URLは使える */ }
  return id
}

export async function stopShare(uid: string, term: string): Promise<void> {
  const id = storedShareId(uid, term)
  if (!id) return
  await deleteDoc(doc(sharedDb(), 'sharedTimetables', id))
  try { localStorage.removeItem(idKey(uid, term)) } catch { /* 無視 */ }
}

export async function fetchShare(id: string): Promise<SharedTimetable | null> {
  if (!/^[0-9a-f]{20,64}$/.test(id)) return null
  const snap = await getDoc(doc(sharedDb(), 'sharedTimetables', id))
  if (!snap.exists()) return null
  const x = snap.data() as Partial<SharedTimetable>
  if (!x.ownerUid || !Array.isArray(x.cells)) return null
  return {
    ownerUid: x.ownerUid, ownerName: x.ownerName ?? '', termLabel: x.termLabel ?? '',
    periods: Math.min(7, Math.max(5, Number(x.periods) || 6)), saturday: x.saturday === true,
    cells: x.cells.filter((c) => typeof c?.d === 'number' && typeof c?.p === 'number').map((c) => ({ d: c.d, p: c.p, t: String(c.t ?? ''), r: String(c.r ?? ''), k: c.k })),
  }
}
