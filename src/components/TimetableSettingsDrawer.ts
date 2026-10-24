import { CREDIT_GROUPS, sumCredits, loadTimetableSettings, saveTimetableSettings, type TimetableSettings } from '../timetableSettings'
import type { TimetableSlot } from '../timetable'
import { academicMonths, categoryOf, type Campus } from '../academicCalendar'

type View = 'main' | 'credits' | 'calendar'

/** 右から出る設定画面。アプリの「時間割の設定」(単位・学事暦・時限数・曜日)と同じ並び */
export function openTimetableSettings(slots: TimetableSlot[], term: string, onChange: (s: TimetableSettings) => void, onSignOut: () => void): void {
  document.getElementById('tt-settings-root')?.remove()
  const root = document.createElement('div')
  root.id = 'tt-settings-root'
  root.className = 'tts-root'
  document.body.appendChild(root)
  let settings = loadTimetableSettings()
  let view: View = 'main'
  let campus: Campus = 'aoyama'

  const close = () => {
    root.classList.remove('tts-open')
    window.setTimeout(() => root.remove(), 250)
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)

  const seg = (name: string, options: { value: string; label: string }[], current: string) =>
    `<div class="tts-seg" role="radiogroup">${options.map((o) =>
      `<button type="button" class="tts-seg-btn${o.value === current ? ' tts-seg-btn--on' : ''}" data-seg="${name}" data-value="${o.value}" role="radio" aria-checked="${o.value === current}">${o.label}</button>`).join('')}</div>`

  let painted = false
  const render = () => {
    let title = '時間割の設定'
    let body = ''
    if (view === 'main') {
      body = `
        <button class="tts-row" type="button" data-go="credits"><strong>単位</strong><small>取った単位と、卒業までの残り</small></button>
        <button class="tts-row" type="button" data-go="calendar"><strong>学事暦</strong><small>授業日・休講・試験の日程</small></button>
        <p class="tts-section">表示</p>
        <div class="tts-field"><span>時限数</span>${seg('periods', [5, 6, 7].map((n) => ({ value: String(n), label: String(n) })), String(settings.periods))}</div>
        <div class="tts-field"><span>曜日</span>${seg('days', [{ value: 'weekday', label: '平日のみ' }, { value: 'sat', label: '平日＋土' }], settings.includeSaturday ? 'sat' : 'weekday')}</div>
        <p class="tts-note">この端末のブラウザに保存されます(アプリの設定とは別です)。</p>
        <button class="tts-signout" type="button" data-signout>ログアウト</button>`
    } else if (view === 'credits') {
      title = '単位'
      const sums = sumCredits(slots.map((s) => s.course))
      const total = CREDIT_GROUPS.reduce((n, g) => n + sums[g.key], 0)
      const required = CREDIT_GROUPS.reduce((n, g) => n + g.required, 0)
      body = `
        <p class="tts-lead">${term}の登録授業から数えた単位です</p>
        <div class="tts-credit-total"><b>${total}</b><span> / ${required} 単位</span></div>
        ${CREDIT_GROUPS.map((g) => `
          <div class="tts-credit"><div class="tts-credit-head"><span>${g.title}</span><span><b>${sums[g.key]}</b> / ${g.required}</span></div>
          <div class="tts-bar"><i style="width:${Math.min(100, Math.round(sums[g.key] / g.required * 100))}%"></i></div></div>`).join('')}
        <p class="tts-note">過去の学期の単位や成績は、アプリで管理しています。必要単位は標準の目安(24 / 62 / 38)です。</p>`
    } else {
      title = '学事暦'
      const today = new Date()
      const todayKey = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
      const months = academicMonths().map((m) => {
        const isNow = m.year === today.getFullYear() && m.month === today.getMonth() + 1
        const rows = m.weeks.map((w) => `<div class="cal-week">${w.map((d) => {
          if (!d) return '<span class="cal-cell"></span>'
          const cat = categoryOf(d, campus)
          const isToday = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() === todayKey
          return `<span class="cal-cell"><i class="cal-num cal-${isToday ? 'today' : cat}">${d.getDate()}</i>${cat === 'class' && !isToday ? '<b class="cal-dot"></b>' : ''}${cat === 'class' && isToday ? '<b class="cal-dot"></b>' : ''}</span>`
        }).join('')}</div>`).join('')
        return `<section class="cal-month" ${isNow ? 'data-now' : ''}><h3 class="cal-month-title${isNow ? ' cal-month-title--now' : ''}">${m.year}年${m.month}月</h3>${rows}</section>`
      }).join('')
      body = `
        <div class="tts-seg cal-campus" role="radiogroup">${(['aoyama', 'sagamihara'] as Campus[]).map((c) => `<button type="button" class="tts-seg-btn${c === campus ? ' tts-seg-btn--on' : ''}" data-campus="${c}">${c === 'aoyama' ? '青山' : '相模原'}</button>`).join('')}</div>
        <div class="cal-weekdays">${['月', '火', '水', '木', '金', '土', '日'].map((d, i) => `<span${i === 6 ? ' class="cal-sun"' : ''}>${d}</span>`).join('')}</div>
        <div class="cal-scroll" id="cal-scroll">${months}</div>
        <div class="cal-legend">
          <span><b class="cal-dot"></b>授業日</span><span><i class="cal-key cal-kyuko"></i>休講日</span><span><i class="cal-key cal-makeup"></i>補講日</span>
          <span><i class="cal-key cal-exam"></i>試験期間</span><span><i class="cal-key cal-break"></i>長期休業</span><span><i class="cal-key cal-today"></i>今日</span>
        </div>
        <p class="tts-note">こちらのカレンダーは学事暦および指定の分類に基づいていますが、必ずしも授業実施日を保証するものではありません。</p>`
    }
    root.innerHTML = `
      <div class="tts-dim" data-close></div>
      <aside class="tts-panel${painted ? ' tts-panel--shown' : ''}" role="dialog" aria-label="${title}">
        <header class="tts-head">
          ${view === 'main' ? '<span class="tts-spacer"></span>' : '<button class="tts-back" type="button" data-go="main" aria-label="戻る">‹</button>'}
          <h2>${title}</h2>
          <button class="tts-x" type="button" data-close aria-label="閉じる">×</button>
        </header>
        <div class="tts-body">${body}</div>
      </aside>`
    painted = true
    root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close))
    root.querySelectorAll<HTMLElement>('[data-go]').forEach((el) => el.addEventListener('click', () => { view = el.dataset.go as View; render() }))
    root.querySelectorAll<HTMLElement>('[data-campus]').forEach((el) => el.addEventListener('click', () => { campus = el.dataset.campus as Campus; render() }))
    if (view === 'calendar') root.querySelector('[data-now]')?.scrollIntoView({ block: 'start' })
    root.querySelector('[data-signout]')?.addEventListener('click', onSignOut)
    root.querySelectorAll<HTMLElement>('[data-seg]').forEach((el) => el.addEventListener('click', () => {
      if (el.dataset.seg === 'periods') settings = { ...settings, periods: Number(el.dataset.value) as 5 | 6 | 7 }
      else settings = { ...settings, includeSaturday: el.dataset.value === 'sat' }
      saveTimetableSettings(settings)
      onChange(settings)
      render()
    }))
  }
  render()
  requestAnimationFrame(() => root.classList.add('tts-open'))
}
