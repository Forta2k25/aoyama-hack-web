import type { Course } from '../timetable'
import { dayName } from '../timetable'
import { searchCoursesForSlot } from './SyllabusSearch'

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** 空きコマの「+」を押したときの、授業を選ぶ画面。シラバスから探すか、名前だけ入れて追加できる。 */
export function openGuestSlotPicker(day: number, period: number, onPick: (course: Course) => void): void {
  document.getElementById('guest-slot-picker')?.remove()
  const root = document.createElement('div')
  root.id = 'guest-slot-picker'
  root.className = 'slot-picker'
  root.innerHTML = `
    <div class="slot-picker-card" role="dialog" aria-modal="true" aria-label="授業を追加">
      <div class="slot-picker-head">
        <h2>${dayName(day)}曜 ${period}限に授業を追加</h2>
        <button class="slot-picker-close" type="button" aria-label="閉じる">×</button>
      </div>
      <input class="slot-picker-input" type="search" placeholder="授業名や教員名で絞り込み" autocomplete="off">
      <div class="slot-picker-results" aria-live="polite"></div>
      <form class="slot-picker-manual">
        <input name="title" type="text" placeholder="一覧にない授業は、名前を入れて追加" maxlength="60" required>
        <button class="btn btn-ghost" type="submit">追加</button>
      </form>
    </div>`
  document.body.appendChild(root)
  document.body.classList.add('modal-open')

  const results = root.querySelector<HTMLElement>('.slot-picker-results')!
  const input = root.querySelector<HTMLInputElement>('.slot-picker-input')!
  const close = () => { root.remove(); document.body.classList.remove('modal-open'); document.removeEventListener('keydown', onKey) }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)
  root.addEventListener('click', e => { if (e.target === root) close() })
  root.querySelector('.slot-picker-close')!.addEventListener('click', close)

  let found: Course[] = []
  let request = 0
  const search = async () => {
    const mine = ++request
    results.innerHTML = '<p class="slot-picker-note">読み込み中…</p>'
    try {
      const all = await searchCoursesForSlot(day, period)
      if (mine !== request) return
      const keyword = input.value.trim()
      found = keyword ? all.filter(c => c.title.includes(keyword) || c.teacher.includes(keyword)) : all
      results.innerHTML = found.length
        ? found.slice(0, 80).map((c, i) => `<button type="button" class="slot-picker-item" data-i="${i}"><strong>${esc(c.title)}</strong><span>${esc(c.teacher)}${c.room ? ' ・ ' + esc(c.room) : ''}</span></button>`).join('')
        : '<p class="slot-picker-note">この時間の授業が見つかりませんでした。下から名前を入れて追加できます。</p>'
    } catch {
      if (mine === request) results.innerHTML = '<p class="slot-picker-note">授業の一覧を読み込めませんでした。下から名前を入れて追加できます。</p>'
    }
  }
  let timer: number | undefined
  input.addEventListener('input', () => { window.clearTimeout(timer); timer = window.setTimeout(search, 200) })
  results.addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.slot-picker-item')
    const course = item ? found[Number(item.dataset.i)] : undefined
    if (course) { close(); onPick(course) }
  })
  root.querySelector<HTMLFormElement>('.slot-picker-manual')!.addEventListener('submit', e => {
    e.preventDefault()
    const title = new FormData(e.currentTarget as HTMLFormElement).get('title')?.toString().trim()
    if (!title) return
    close()
    onPick({ id: `manual-${Date.now()}`, title, room: '', teacher: '' })
  })
  void search()
}
