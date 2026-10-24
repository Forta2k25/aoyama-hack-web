// ログインしていない人の時間割。この端末のブラウザ(localStorage)にだけ保存する。サーバーには送らない。
import type { Course, TimetableSlot } from './timetable'

const KEY = 'aoyama-hack.guest-timetable.v1'
const COLORS = ['green', 'sky', 'orange', 'pink', 'mint', 'purple', 'yellow', 'blue', 'red', 'brown']

interface Stored { term: string; slots: Record<string, Course> }

function read(term: string): Stored {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null
    if (data && data.term === term && data.slots) return data
  } catch { /* 壊れていたら空から始める */ }
  return { term, slots: {} }
}

function write(data: Stored): void {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* 保存できない環境では、その場だけ */ }
}

export function loadGuestSlots(term: string): TimetableSlot[] {
  return Object.entries(read(term).slots).map(([key, course]) => {
    const [day, period] = key.split('-').map(Number)
    return { day, period, course }
  })
}

export function setGuestCourse(term: string, day: number, period: number, course: Course): void {
  const data = read(term)
  const used = new Set(Object.values(data.slots).map(c => c.colorKey))
  const colorKey = COLORS.find(c => !used.has(c)) ?? COLORS[Object.keys(data.slots).length % COLORS.length]
  data.slots[`${day}-${period}`] = { ...course, colorKey: course.colorKey ?? colorKey }
  write(data)
}

export function removeGuestCourse(term: string, day: number, period: number): void {
  const data = read(term)
  delete data.slots[`${day}-${period}`]
  write(data)
}
