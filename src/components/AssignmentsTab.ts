import { subscribeAssignments, setSubmitted, groupAssignments, timeLabel, type AssignmentItem, type AssignmentState } from '../assignments'

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export const assignmentsPanelMarkup = `<div id="tab-panel-assignments" hidden><div id="assignments-inner" class="assignments"><div class="mypage-loading"><div class="mypage-spinner"></div><span>読み込み中...</span></div></div></div>`

function rowMarkup(it: AssignmentItem, submitted: boolean): string {
  const title = it.url ? `<a href="${escapeHtml(it.url)}" target="_blank" rel="noopener">${escapeHtml(it.title)}</a>` : escapeHtml(it.title)
  return `
    <div class="as-row${submitted ? ' as-row--done' : ''}">
      <button class="as-check" type="button" data-uid="${escapeHtml(it.uid)}" data-on="${submitted}" aria-pressed="${submitted}" aria-label="${submitted ? '提出済みを取り消す' : '提出済みにする'}">${submitted ? '✓' : ''}</button>
      <div class="as-main"><span class="as-title">${title}</span>${it.course ? `<span class="as-course">${escapeHtml(it.course)}</span>` : ''}</div>
      ${it.due !== null ? `<span class="as-time">${timeLabel(it.due)}</span>` : ''}
    </div>`
}

/** 課題タブ。アプリと同じ課題を、Webで見て、提出済みをつけられる */
export function mountAssignments(uid: string): void {
  const host = document.getElementById('assignments-inner')
  if (!host) return
  let pastOpen = false
  let state: AssignmentState | null | undefined
  const paint = () => {
    if (state === undefined) return
    if (!state || state.items.length === 0) {
      host.innerHTML = `<div class="mypage-empty"><p>まだ課題がありません。</p><p>アプリで、Moodleの課題を設定すると、ここにも表示されます。</p></div>`
      return
    }
    const { upcoming, past } = groupAssignments(state.items)
    const s = state.submitted
    host.innerHTML = `
      ${upcoming.length === 0 ? '<div class="mypage-empty"><p>期限が先の課題はありません。</p></div>' : upcoming.map((g) => `
        <section class="as-group"><h3 class="as-date">${g.label}</h3>${g.items.map((it) => rowMarkup(it, s.has(it.uid))).join('')}</section>`).join('')}
      ${past.length ? `<section class="as-group"><button class="as-past-toggle" type="button" id="as-past-toggle">${pastOpen ? '▾' : '▸'} 期限切れ(${past.length})</button>${pastOpen ? past.map((it) => rowMarkup(it, s.has(it.uid))).join('') : ''}</section>` : ''}`
    host.querySelector('#as-past-toggle')?.addEventListener('click', () => { pastOpen = !pastOpen; paint() })
    host.querySelectorAll<HTMLButtonElement>('.as-check').forEach((b) => b.addEventListener('click', () => {
      const next = b.dataset.on !== 'true'
      b.disabled = true
      void setSubmitted(uid, b.dataset.uid!, next).catch(() => { b.disabled = false; window.alert('提出済みの印を保存できませんでした。通信を確認して、もう一度お試しください。') })
    }))
  }
  subscribeAssignments(uid, (s) => { state = s; paint() }, () => {
    host.innerHTML = `<div class="mypage-error"><p>課題を読み込めませんでした。</p></div>`
  })
}
