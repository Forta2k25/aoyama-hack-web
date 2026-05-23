import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

export interface Course {
  id: string
  title: string
  room: string
  teacher: string
  credits?: number
  campus?: string
  category?: string
  syllabusURL?: string
  colorKey?: string
}

export interface TimetableSlot {
  day: number    // 0=月 … 4=金（5=土も存在する）
  period: number // 1 始まり
  course: Course
}

const DAY_NAMES = ['月', '火', '水', '木', '金', '土']

// Firestore のドキュメントIDは "assignedCourses.{year}_{semester}"
function currentTermDocId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const semester = month >= 4 && month <= 9 ? '前期' : '後期'
  const termYear = month >= 1 && month <= 3 ? year - 1 : year
  return `assignedCourses.${termYear}_${semester}`
}

export function termLabel(): string {
  const docId = currentTermDocId()
  const match = docId.match(/assignedCourses\.(\d+)_(.+)/)
  return match ? `${match[1]}年${match[2]}` : ''
}

export async function fetchTimetable(uid: string): Promise<TimetableSlot[]> {
  const docId = currentTermDocId()
  const ref = doc(db, 'users', uid, 'timetable', docId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return []

  const data = snap.data() as Record<string, unknown>
  const slots: TimetableSlot[] = []

  for (const [key, value] of Object.entries(data)) {
    // キー形式: "cells.d{day}p{period}" または フラットな "d{day}p{period}"
    const match = key.match(/^(?:cells\.)?d(\d+)p(\d+)$/)
    if (!match || typeof value !== 'object' || !value) continue
    const m = value as Record<string, unknown>
    slots.push({
      day: parseInt(match[1], 10),
      period: parseInt(match[2], 10),
      course: {
        id: (m['id'] as string) ?? '',
        title: (m['title'] as string) ?? '（無題）',
        room: (m['room'] as string) ?? '',
        teacher: (m['teacher'] as string) ?? '',
        credits: m['credits'] as number | undefined,
        campus: m['campus'] as string | undefined,
        category: m['category'] as string | undefined,
        syllabusURL: m['syllabusURL'] as string | undefined,
        colorKey: m['colorKey'] as string | undefined,
      },
    })
  }

  return slots
}

// 色キー → CSS色（アプリの SlotColor に合わせた淡いパステル系）
const COLOR_MAP: Record<string, string> = {
  red:    '#fde8e8',
  orange: '#fdefd8',
  yellow: '#fdf8d8',
  green:  '#e2f5e8',
  mint:   '#d8f5ef',
  sky:    '#daf0fb',
  blue:   '#dde8fb',
  purple: '#ece0fb',
  pink:   '#fde0ee',
  brown:  '#f0e8df',
}

export const slotColor = (key?: string) => (key ? (COLOR_MAP[key] ?? '#f0f0f0') : '#f0f0f0')
export const dayName = (day: number) => DAY_NAMES[day] ?? ''
