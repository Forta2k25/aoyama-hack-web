import { fetchShare, type SharedTimetable } from '../sharedTimetable'
import type { TimetableSlot } from '../timetable'
import { timetableMarkup } from './MyPage'

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export const sharedTimetablePageMarkup = `
  <main class="page-main mypage">
    <section class="content-page reveal">
      <div id="shared-timetable"><div class="mypage-loading"><div class="mypage-spinner"></div><span>読み込み中...</span></div></div>
    </section>
  </main>
`

export function sharedSlots(share: SharedTimetable): TimetableSlot[] {
  return share.cells.map((c) => ({ day: c.d, period: c.p, course: { id: '', title: c.t, room: c.r, teacher: '', colorKey: c.k } }))
}

export async function renderSharedTimetable(id: string): Promise<void> {
  const host = document.getElementById('shared-timetable')
  if (!host) return
  let share: SharedTimetable | null = null
  try { share = await fetchShare(id) } catch { share = null }
  if (!share) {
    host.innerHTML = `<div class="mypage-error"><p>この時間割は見つかりませんでした。</p><p>共有が停止されたか、URLが違う可能性があります。</p><a class="btn btn-ghost" href="/">トップへ</a></div>`
    return
  }
  const name = share.ownerName.trim() || '友だち'
  document.title = `${name}さんの時間割 | 青山ハック`
  const days = share.saturday ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4]
  const periods = Array.from({ length: share.periods }, (_, i) => i + 1)
  host.innerHTML = `
    <div class="shared-head">
      <h1 class="shared-title">${escapeHtml(name)}さんの時間割</h1>
      <p class="shared-term">${escapeHtml(share.termLabel)}</p>
    </div>
    ${timetableMarkup(sharedSlots(share), share.termLabel, share.saturday, false, true, false, { days, periods })}
    <div class="shared-cta">
      <p>自分の時間割も、青山ハックで作れます。</p>
      <a class="btn btn-primary" href="/">時間割をつくる</a>
    </div>`
}
