// ログイン前に見せる、空の時間割の表。Firebaseなどには触れない(学生向けの入口を軽く保つため)。
const PERIODS: Array<[string, string]> = [
  ['9:00', '10:30'], ['11:00', '12:30'], ['13:20', '14:50'], ['15:05', '16:35'], ['16:50', '18:20'], ['18:30', '20:00'],
]
const DAYS = ['月', '火', '水', '木', '金']

export function currentTermLabel(now = new Date()): string {
  const month = now.getMonth() + 1
  const year = month <= 3 ? now.getFullYear() - 1 : now.getFullYear()
  return `${year}年${month >= 4 && month <= 9 ? '前期' : '後期'}`
}

export function guestTimetableMarkup(now = new Date()): string {
  const today = (now.getDay() + 6) % 7
  const head = DAYS.map((d, i) => `<th class="tt-day-header${i === today ? ' tt-day-header--today' : ''}">${d}</th>`).join('')
  const rows = PERIODS.map(([start, end], i) => `<tr><th class="tt-period-header">
      <span class="tt-period-time">${start}</span><span class="tt-period-num">${i + 1}</span><span class="tt-period-time">${end}</span>
    </th>${DAYS.map(() => '<td class="tt-cell tt-cell-empty"><div class="tt-cell-inner"></div></td>').join('')}</tr>`).join('')
  return `
    <div class="tt-wrapper student-tt">
      <div class="tt-label-row"><span class="eyebrow">${currentTermLabel(now)}</span></div>
      <div class="tt-scroll">
        <table class="tt-table" aria-label="時間割">
          <thead><tr><th class="tt-corner"></th>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`
}
