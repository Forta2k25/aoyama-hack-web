// 時間割の表示設定(アプリの「時間割の設定」と同じ項目)。アプリと同じく、この端末だけに保存する。
export interface TimetableSettings {
  periods: 5 | 6 | 7
  includeSaturday: boolean
}

const KEY = 'aoyama-hack.timetable-settings.v1'
export const DEFAULT_SETTINGS: TimetableSettings = { periods: 6, includeSaturday: false }

export function loadTimetableSettings(): TimetableSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<TimetableSettings> | null
    const periods = raw?.periods === 5 || raw?.periods === 6 || raw?.periods === 7 ? raw.periods : DEFAULT_SETTINGS.periods
    return { periods, includeSaturday: raw?.includeSaturday === true }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveTimetableSettings(settings: TimetableSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* 保存できなくても表示は変わる */ }
}

/** 授業が入っているコマは、設定で隠れないようにする */
export function visibleGrid(settings: TimetableSettings, slots: { day: number; period: number }[]): { days: number[]; periods: number[] } {
  const lastPeriod = Math.max(settings.periods, ...slots.map((s) => s.period))
  const showSaturday = settings.includeSaturday || slots.some((s) => s.day === 5)
  return {
    days: showSaturday ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4],
    periods: Array.from({ length: Math.min(lastPeriod, 7) }, (_, i) => i + 1),
  }
}

// ── 単位 ────────────────────────────────────────────────────────────────────
export type CreditGroup = 'aoyama' | 'department' | 'free'
export const CREDIT_GROUPS: { key: CreditGroup; title: string; required: number }[] = [
  { key: 'aoyama', title: '青山スタンダード', required: 24 },
  { key: 'department', title: '学科科目', required: 62 },
  { key: 'free', title: '自由選択科目', required: 38 },
]

export function classifyCategory(category?: string): CreditGroup {
  const c = (category ?? '').toLowerCase()
  if (c.includes('スタンダード') || c.includes('standard')) return 'aoyama'
  if (c.includes('学科') || c.includes('英米') || c.includes('department')) return 'department'
  return 'free'
}

export function sumCredits(courses: { id: string; title: string; credits?: number; category?: string }[]): Record<CreditGroup, number> {
  const seen = new Set<string>()
  const total: Record<CreditGroup, number> = { aoyama: 0, department: 0, free: 0 }
  for (const c of courses) {
    const key = c.id || c.title
    if (seen.has(key)) continue
    seen.add(key)
    total[classifyCategory(c.category)] += c.credits ?? 0
  }
  return total
}

// ── 学事暦(2026年度。アプリの AcademicCalendar2026 と同じ日程) ─────────────────
export const ACADEMIC_CALENDAR_2026: { label: string; range: string }[] = [
  { label: '前期授業', range: '2026/4/6 〜 7/23' },
  { label: '前期試験', range: '2026/7/24 〜 7/31' },
  { label: '夏期休業', range: '2026/8/1 〜 9/12' },
  { label: '後期授業', range: '2026/9/14 〜 12/22' },
  { label: '冬期休業', range: '2026/12/23 〜 2027/1/7' },
  { label: '後期授業(再開)', range: '2027/1/8 〜 1/25' },
  { label: '後期試験', range: '2027/1/26 〜 2/2' },
  { label: '春期休業', range: '2027/2/3 〜 3/27' },
]
