// 学事暦(2026年度)。アプリの AcademicCalendar2026 と同じ日程・同じ判定。
export type Campus = 'aoyama' | 'sagamihara'
export type DayCategory = 'class' | 'sunday' | 'kyuko' | 'makeup' | 'exam' | 'break'

const key = (y: number, m: number, d: number) => y * 10000 + m * 100 + d
const dateKey = (date: Date) => key(date.getFullYear(), date.getMonth() + 1, date.getDate())
const within = (k: number, a: number, b: number) => k >= a && k <= b
const set = (...ks: number[]) => new Set(ks)

const SPRING_START = key(2026, 4, 6), SPRING_END = key(2026, 7, 23)
const SPRING_EXAM: [number, number] = [key(2026, 7, 24), key(2026, 7, 31)]
const SUMMER: [number, number] = [key(2026, 8, 1), key(2026, 9, 12)]
const AUTUMN_START = key(2026, 9, 14), AUTUMN_END_1 = key(2026, 12, 22)
const WINTER: [number, number] = [key(2026, 12, 23), key(2027, 1, 7)]
const AUTUMN_RESUME = key(2027, 1, 8), AUTUMN_END_2 = key(2027, 1, 25)
const AUTUMN_EXAM: [number, number] = [key(2027, 1, 26), key(2027, 2, 2)]
const SPRING_BREAK: [number, number] = [key(2027, 2, 3), key(2027, 3, 27)]

const MAKEUP_BOTH = set(key(2026, 7, 23), key(2027, 1, 21))
const MAKEUP_SAGAMIHARA = set(key(2027, 1, 22))
const KYUKO_BOTH = set(key(2026, 10, 30), key(2026, 10, 31), key(2026, 11, 1), key(2026, 11, 2))
const KYUKO_AOYAMA = set(key(2027, 1, 15), key(2027, 1, 16))
const KYUKO_SAGAMIHARA = set(key(2026, 10, 10))
const HOLIDAY_BUT_CLASS = set(key(2026, 4, 29), key(2026, 7, 20), key(2026, 9, 21), key(2026, 10, 12), key(2026, 11, 16))
const NATIONAL_HOLIDAYS = set(
  key(2026, 5, 3), key(2026, 5, 4), key(2026, 5, 5), key(2026, 5, 6), key(2026, 8, 11), key(2026, 9, 22), key(2026, 9, 23),
  key(2026, 11, 3), key(2026, 11, 23), key(2027, 1, 1), key(2027, 1, 11), key(2027, 2, 11), key(2027, 2, 23), key(2027, 3, 22),
)

export function categoryOf(date: Date, campus: Campus): DayCategory {
  const k = dateKey(date)
  if (date.getDay() === 0) return 'sunday'
  if (within(k, ...SUMMER) || within(k, ...WINTER) || within(k, ...SPRING_BREAK)) return 'break'
  if (within(k, ...SPRING_EXAM) || within(k, ...AUTUMN_EXAM)) return 'exam'
  if (MAKEUP_BOTH.has(k) || (campus === 'sagamihara' && MAKEUP_SAGAMIHARA.has(k))) return 'makeup'
  if (HOLIDAY_BUT_CLASS.has(k)) return 'class'
  if (KYUKO_BOTH.has(k) || NATIONAL_HOLIDAYS.has(k)) return 'kyuko'
  if (campus === 'aoyama' && KYUKO_AOYAMA.has(k)) return 'kyuko'
  if (campus === 'sagamihara' && KYUKO_SAGAMIHARA.has(k)) return 'kyuko'
  if (within(k, SPRING_START, SPRING_END) || within(k, AUTUMN_START, AUTUMN_END_1) || within(k, AUTUMN_RESUME, AUTUMN_END_2)) return 'class'
  return 'kyuko'
}

/** 2026年度の12か月(4月〜翌3月)。月曜はじまりの週ごとの日(月の外は null) */
export function academicMonths(): { year: number; month: number; weeks: (Date | null)[][] }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const year = i < 9 ? 2026 : 2027
    const month = ((i + 3) % 12) + 1
    const last = new Date(year, month, 0).getDate()
    const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7
    const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: last }, (_, d) => new Date(year, month - 1, d + 1))]
    while (cells.length % 7) cells.push(null)
    return { year, month, weeks: Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7)) }
  })
}
