import { type AuthUser } from '../auth'
import { fetchTimetable, fetchCourseDetail, termLabel, slotColor, dayName, type TimetableSlot } from '../timetable'
import { fetchAndParseSyllabus, type SyllabusContent, type EvalItem } from '../syllabus'
import { syllabusSearchMarkup, initSyllabusSearch } from './SyllabusSearch'

const DAYS = [0, 1, 2, 3, 4] // 月〜金（土は登録があれば後から拡張）
const MAX_PERIODS = 6

function courseDetailModalMarkup() {
  return `
    <div class="course-modal-overlay" id="course-modal" aria-modal="true" role="dialog" hidden>
      <div class="course-modal-card">
        <button class="course-modal-close" id="course-modal-close" aria-label="閉じる">
          <span></span><span></span>
        </button>
        <div class="course-modal-scroll">
          <div class="course-modal-body" id="course-modal-body"></div>
        </div>
      </div>
    </div>
  `
}

// 成績評価バー
function evalBarMarkup(items: EvalItem[]): string {
  if (!items.length) return ''
  const COLORS = ['#2d8067', '#f5a623', '#4a90e2', '#9b59b6', '#e74c3c']
  const bar = items.map((it, i) => {
    const pct = parseFloat(it.percent) || 0
    return `<div style="width:${pct}%;background:${COLORS[i % COLORS.length]};height:100%;"></div>`
  }).join('')
  const legend = items.map((it, i) => `
    <div class="eval-legend-item">
      <span class="eval-dot" style="background:${COLORS[i % COLORS.length]}"></span>
      <span class="eval-legend-name">${it.name}</span>
      <span class="eval-legend-pct" style="color:${COLORS[i % COLORS.length]}">${it.percent}</span>
      ${it.description ? `<span class="eval-legend-desc">${it.description}</span>` : ''}
    </div>`).join('')
  return `
    <div class="course-section">
      <p class="course-section-label">成績評価</p>
      <div class="eval-bar">${bar}</div>
      <div class="eval-legend">${legend}</div>
    </div>`
}

// 授業計画リスト（現在週ハイライト）
function lecturePlanMarkup(items: string[], currentWeek: number): string {
  if (!items.length) return ''
  const rows = items.map((item) => {
    const match = item.match(/^(\d+)\.\s*(.+)$/)
    if (!match) return `<li class="lecture-item">${item}</li>`
    const num = parseInt(match[1], 10)
    const text = match[2]
    const isCurrent = num === currentWeek
    return `<li class="lecture-item${isCurrent ? ' lecture-item--current' : ''}">
      <span class="lecture-num">${num}</span>
      <span class="lecture-text">${text}</span>
      ${isCurrent ? '<span class="lecture-now-badge">今週</span>' : ''}
    </li>`
  }).join('')
  return `
    <div class="course-section">
      <p class="course-section-label">授業計画</p>
      <ol class="lecture-list">${rows}</ol>
    </div>`
}

// テキストセクション
function textSection(label: string, text: string | undefined): string {
  if (!text) return ''
  return `<div class="course-section">
    <p class="course-section-label">${label}</p>
    <p class="course-section-text">${text.replace(/\n/g, '<br>')}</p>
  </div>`
}

// 授業方法チップ
function methodChipsMarkup(methods: SyllabusContent['methods']): string {
  if (!methods.length) return ''
  const chips = methods.map((m) =>
    `<span class="method-chip${m.checked ? ' method-chip--active' : ''}">${m.checked ? '✓ ' : ''}${m.name}</span>`
  ).join('')
  return `<div class="course-section">
    <p class="course-section-label">活用される授業方法</p>
    <div class="method-chips">${chips}</div>
  </div>`
}

// 教科書リスト
function booksMarkup(label: string, books: SyllabusContent['textbooks']): string {
  if (!books.length) return ''
  const items = books.map((b, i) =>
    `<div class="book-item"><span class="book-num">${i + 1}</span>
      <div><span class="book-title">『${b.title}』</span>
      ${b.author ? `<small class="book-author">${b.author}</small>` : ''}</div>
    </div>`
  ).join('')
  return `<div class="course-section">
    <p class="course-section-label">${label}</p>
    ${items}
  </div>`
}

function currentWeekNumber(): number {
  // 4/1 を前期第1週の起点として計算
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const semesterStart = new Date(year, 3, 1)
  const diff = Math.floor((now.getTime() - semesterStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, Math.min(15, diff + 1))
}

function courseDetailBodyMarkup(
  course: import('../timetable').Course,
  detail?: import('../timetable').CourseDetail,
  syllabus?: SyllabusContent | null,
  loading = false
): string {
  const chips = [
    course.teacher && `<span class="info-chip">担当教員：${course.teacher}</span>`,
    detail?.grade  && `<span class="info-chip">年度：${detail.grade}</span>`,
    detail?.term   && `<span class="info-chip">学期：${detail.term}</span>`,
    (course.credits ?? detail?.credit) != null
      && `<span class="info-chip">単位：${course.credits ?? detail?.credit}単位</span>`,
    course.room    && `<span class="info-chip">教室：${course.room}</span>`,
  ].filter(Boolean).join('')

  const syllabusURL = course.syllabusURL || detail?.syllabusURL || ''
  const syllabusLink = syllabusURL
    ? `<a class="course-syllabus-ext" href="${syllabusURL}" target="_blank" rel="noopener noreferrer">ブラウザで全文を見る ↗</a>`
    : ''

  if (loading) {
    return `
      <h2 class="course-modal-title">${course.title}</h2>
      ${syllabusLink}
      <div class="info-chips">${chips}</div>
      <div class="course-loading-center"><span class="mypage-spinner" style="width:24px;height:24px;border-width:2px"></span></div>
    `
  }

  const week = currentWeekNumber()
  return `
    <h2 class="course-modal-title">${course.title}</h2>
    ${syllabusLink}
    <div class="info-chips">${chips}</div>
    ${syllabus ? evalBarMarkup(syllabus.evalItems) : (detail?.evalMethod ? `<div class="course-section"><p class="course-section-label">成績評価方法</p><p class="course-section-text">${detail.evalMethod.replace(/\n/g, '<br>')}</p></div>` : '')}
    ${syllabus ? lecturePlanMarkup(syllabus.lectureItems, week) : ''}
    ${syllabus ? textSection('講義概要', syllabus.outline) : ''}
    ${syllabus ? textSection('達成目標', syllabus.objective) : ''}
    ${syllabus ? methodChipsMarkup(syllabus.methods) : ''}
    ${syllabus ? booksMarkup('教科書', syllabus.textbooks) : ''}
    ${syllabus ? booksMarkup('参考書', syllabus.refs) : ''}
  `
}

let _outsideClickHandler: ((e: MouseEvent) => void) | null = null

export function openCourseModal(course: import('../timetable').Course) {
  const timetableActive = !document.getElementById('tab-panel-timetable')?.hasAttribute('hidden')
  if (window.innerWidth >= 800 && timetableActive) {
    const panel = document.getElementById('course-side-panel')
    const body = document.getElementById('course-side-body')
    if (!panel || !body) return

    body.innerHTML = courseDetailBodyMarkup(course, undefined, undefined, true)
    panel.classList.add('is-open')

    // パネルが画面内に収まるようスクロール
    const layout = document.getElementById('mypage-layout')
    if (layout) {
      const top = layout.getBoundingClientRect().top + window.scrollY - 96
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }

    // パネル外クリックで閉じる
    if (_outsideClickHandler) document.removeEventListener('click', _outsideClickHandler)
    _outsideClickHandler = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.('#course-side-panel')) closeCourseModal()
    }
    setTimeout(() => document.addEventListener('click', _outsideClickHandler!), 100)

    fetchCourseDetail(course)
      .then(async (detail) => {
        if (!panel.classList.contains('is-open')) return
        const syllabusURL = course.syllabusURL || detail.syllabusURL || ''
        const syllabus = await fetchAndParseSyllabus(syllabusURL)
        if (panel.classList.contains('is-open')) {
          body.innerHTML = courseDetailBodyMarkup(course, detail, syllabus, false)
        }
      })
      .catch(() => {
        if (panel.classList.contains('is-open')) {
          body.innerHTML = courseDetailBodyMarkup(course, undefined, null, false)
        }
      })
  } else {
    const modal = document.getElementById('course-modal') as HTMLElement | null
    const body = document.getElementById('course-modal-body')
    if (!modal || !body) return

    body.innerHTML = courseDetailBodyMarkup(course, undefined, undefined, true)
    modal.hidden = false
    document.body.classList.add('modal-open')
    ;(modal.querySelector('.course-modal-close') as HTMLElement | null)?.focus()

    fetchCourseDetail(course)
      .then(async (detail) => {
        if (modal.hidden) return
        const syllabusURL = course.syllabusURL || detail.syllabusURL || ''
        const syllabus = await fetchAndParseSyllabus(syllabusURL)
        if (!modal.hidden) {
          body.innerHTML = courseDetailBodyMarkup(course, detail, syllabus, false)
        }
      })
      .catch(() => {
        if (!modal.hidden) {
          body.innerHTML = courseDetailBodyMarkup(course, undefined, null, false)
        }
      })
  }
}

export function closeCourseModal() {
  const modal = document.getElementById('course-modal') as HTMLElement | null
  if (modal) {
    modal.hidden = true
    document.body.classList.remove('modal-open')
  }
  document.getElementById('course-side-panel')?.classList.remove('is-open')
  if (_outsideClickHandler) {
    document.removeEventListener('click', _outsideClickHandler)
    _outsideClickHandler = null
  }
}

function loginMarkup() {
  return `
    <div class="mypage-login">
      <div class="mypage-login-inner">
        <p class="eyebrow">マイページ</p>
        <h1>時間割をウェブでも確認</h1>
        <p>アプリでGoogleアカウントを連携すると、登録した時間割をウェブでも確認できます。</p>
        <div class="mypage-login-steps">
          <p class="mypage-login-steps-label">Web版を使うには</p>
          <ol>
            <li>アプリの <strong>友だち</strong> タブを開く</li>
            <li><strong>自分のプロフィール</strong> をタップ</li>
            <li><strong>Google連携</strong> からアカウントを連携</li>
          </ol>
        </div>
        <button class="btn btn-primary mypage-google-signin" id="mypage-signin-btn" type="button">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Googleでログイン
        </button>
        <p class="mypage-login-note">連携したGoogleアカウントと同じものでログインしてください。</p>
      </div>
    </div>
  `
}

function loadingMarkup() {
  return `
    <div class="mypage-loading">
      <span class="mypage-spinner"></span>
      <p>時間割を読み込み中...</p>
    </div>
  `
}

function emptyMarkup(label: string) {
  return `
    <div class="mypage-empty">
      <p>${label}の時間割はまだ登録されていません。</p>
      <p>アプリから授業を登録してください。</p>
    </div>
  `
}

const PERIOD_TIMES: Record<number, [string, string]> = {
  1: ['9:00',  '10:30'],
  2: ['11:00', '12:30'],
  3: ['13:20', '14:50'],
  4: ['15:05', '16:35'],
  5: ['16:50', '18:20'],
  6: ['18:30', '20:00'],
  7: ['20:10', '21:40'],
}

function timetableMarkup(slots: TimetableSlot[], label: string, hasSaturday: boolean): string {
  const days = hasSaturday ? [0, 1, 2, 3, 4, 5] : DAYS
  const periods = Array.from({ length: MAX_PERIODS }, (_, i) => i + 1)

  // slots を day/period でインデックス
  const grid: Record<string, TimetableSlot> = {}
  slots.forEach((s) => { grid[`${s.day}-${s.period}`] = s })

  const dayHeaders = days.map((d) => `<th class="tt-day-header">${dayName(d)}</th>`).join('')

  const rows = periods.map((p) => {
    const cells = days.map((d) => {
      const slot = grid[`${d}-${p}`]
      if (!slot) {
        return `<td class="tt-cell tt-cell-empty"><div class="tt-cell-inner"></div></td>`
      }
      const bg = slotColor(slot.course.colorKey)
      const roomText = slot.course.room ? `<small class="tt-room">${slot.course.room}</small>` : ''
      const courseJson = encodeURIComponent(JSON.stringify(slot.course))
      return `
        <td class="tt-cell tt-cell-filled" style="background:${bg}" data-course="${courseJson}" tabindex="0" role="button" aria-label="${slot.course.title}">
          <div class="tt-cell-inner">
            <span class="tt-title">${slot.course.title}</span>
            ${roomText}
          </div>
        </td>
      `
    }).join('')
    const [start, end] = PERIOD_TIMES[p] ?? ['', '']
    return `<tr><th class="tt-period-header">
      <span class="tt-period-time">${start}</span>
      <span class="tt-period-num">${p}</span>
      <span class="tt-period-time">${end}</span>
    </th>${cells}</tr>`
  }).join('')

  return `
    <div class="mypage-layout" id="mypage-layout">
      <aside class="course-side-panel" id="course-side-panel">
        <div class="course-side-inner">
          <button class="course-side-close" id="course-side-close" aria-label="閉じる">
            <span></span><span></span>
          </button>
          <div class="course-side-scroll">
            <div class="course-side-body" id="course-side-body"></div>
          </div>
        </div>
      </aside>
      <div class="tt-main">
        <div class="tt-wrapper">
          <div class="tt-label-row">
            <span class="eyebrow">${label}</span>
          </div>
          <div class="tt-scroll">
            <table class="tt-table">
              <thead><tr><th class="tt-corner"></th>${dayHeaders}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
}

export function mypageMarkup() {
  return `
    <main class="page-main mypage">
      <section class="content-page reveal">
        <div id="mypage-content">
          ${loginMarkup()}
        </div>
      </section>
    </main>
  `
}

export async function renderMyPage(user: AuthUser) {
  const container = document.getElementById('mypage-content')
  if (!container) return

  if (!user) {
    container.innerHTML = loginMarkup()
    return
  }

  container.innerHTML = loadingMarkup()

  try {
    const slots = await fetchTimetable(user.uid)
    const label = termLabel()
    const tabsBar = `
      <div class="mypage-tabs-bar">
        <button class="mypage-tab mypage-tab--active" id="tab-timetable" type="button">時間割</button>
        <button class="mypage-tab" id="tab-syllabus" type="button">シラバス</button>
      </div>
    `
    if (slots.length === 0) {
      container.innerHTML = `
        <div class="mypage-header">
          <p class="eyebrow">マイページ</p>
          <button class="btn btn-ghost mypage-signout" id="mypage-signout-btn" type="button">ログアウト</button>
        </div>
        ${tabsBar}
        <div id="tab-panel-timetable">${emptyMarkup(label)}</div>
        <div id="tab-panel-syllabus" hidden>${syllabusSearchMarkup()}</div>
        ${courseDetailModalMarkup()}
      `
    } else {
      const hasSaturday = slots.some((s) => s.day === 5)
      container.innerHTML = `
        <div class="mypage-header">
          <p class="eyebrow">マイページ</p>
          <button class="btn btn-ghost mypage-signout" id="mypage-signout-btn" type="button">ログアウト</button>
        </div>
        ${tabsBar}
        <div id="tab-panel-timetable">${timetableMarkup(slots, label, hasSaturday)}</div>
        <div id="tab-panel-syllabus" hidden>${syllabusSearchMarkup()}</div>
        ${courseDetailModalMarkup()}
      `
      // コマのクリックイベント
      container.querySelectorAll<HTMLElement>('.tt-cell-filled').forEach((cell) => {
        const handler = () => {
          const raw = cell.getAttribute('data-course')
          if (!raw) return
          try {
            openCourseModal(JSON.parse(decodeURIComponent(raw)))
          } catch { /* ignore */ }
        }
        cell.addEventListener('click', handler)
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handler() })
      })
      // パネル・モーダルを閉じる
      document.getElementById('course-side-close')?.addEventListener('click', closeCourseModal)
      document.getElementById('course-modal-close')?.addEventListener('click', closeCourseModal)
      document.getElementById('course-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeCourseModal()
      })
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCourseModal() })
    }
    // タブ切り替え
    const showTab = (tab: 'timetable' | 'syllabus', pushHistory = true) => {
      const isSyllabus = tab === 'syllabus'
      document.getElementById('tab-panel-timetable')?.toggleAttribute('hidden', isSyllabus)
      document.getElementById('tab-panel-syllabus')?.toggleAttribute('hidden', !isSyllabus)
      document.getElementById('tab-timetable')?.classList.toggle('mypage-tab--active', !isSyllabus)
      document.getElementById('tab-syllabus')?.classList.toggle('mypage-tab--active', isSyllabus)
      if (isSyllabus) closeCourseModal()
      if (pushHistory) history.pushState(null, '', location.search + `#${tab}`)
    }
    document.getElementById('tab-timetable')?.addEventListener('click', () => showTab('timetable'))
    document.getElementById('tab-syllabus')?.addEventListener('click',   () => showTab('syllabus'))
    window.addEventListener('popstate', () => {
      showTab(location.hash === '#syllabus' ? 'syllabus' : 'timetable', false)
    })
    // 初期ロード: URL の hash でタブを決定
    if (location.hash === '#syllabus') showTab('syllabus', false)

    initSyllabusSearch(openCourseModal)
  } catch {
    container.innerHTML = `
      <div class="mypage-error">
        <p>時間割の取得に失敗しました。</p>
        <button class="btn btn-ghost" onclick="window.location.reload()">再試行</button>
      </div>
    `
  }
}
