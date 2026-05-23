import { type AuthUser } from '../auth'
import { fetchTimetable, termLabel, slotColor, dayName, type TimetableSlot } from '../timetable'

const DAYS = [0, 1, 2, 3, 4] // 月〜金（土は登録があれば後から拡張）
const MAX_PERIODS = 6

function loginMarkup() {
  return `
    <div class="mypage-login">
      <div class="mypage-login-inner">
        <p class="eyebrow">マイページ</p>
        <h1>時間割をウェブでも確認</h1>
        <p>Googleアカウントでログインすると、アプリに登録した時間割をウェブでも確認できます。</p>
        <button class="btn btn-primary mypage-google-signin" id="mypage-signin-btn" type="button">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Googleでログイン
        </button>
        <p class="mypage-login-note">青学のメールアドレスでなくてもOKです。<br>登録したGoogleアカウントと同じものでログインしてください。</p>
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
      if (!slot) return `<td class="tt-cell tt-cell-empty"></td>`
      const bg = slotColor(slot.course.colorKey)
      const roomText = slot.course.room ? `<small class="tt-room">${slot.course.room}</small>` : ''
      return `
        <td class="tt-cell" style="background:${bg}">
          <span class="tt-title">${slot.course.title}</span>
          ${roomText}
        </td>
      `
    }).join('')
    return `<tr><th class="tt-period-header">${p}</th>${cells}</tr>`
  }).join('')

  return `
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
    if (slots.length === 0) {
      container.innerHTML = `
        <div class="mypage-header">
          <div>
            <p class="eyebrow">マイページ</p>
            <h1>${label} 時間割</h1>
          </div>
          <button class="btn btn-ghost mypage-signout" id="mypage-signout-btn" type="button">ログアウト</button>
        </div>
        ${emptyMarkup(label)}
      `
    } else {
      const hasSaturday = slots.some((s) => s.day === 5)
      container.innerHTML = `
        <div class="mypage-header">
          <div>
            <p class="eyebrow">マイページ</p>
            <h1>${label} 時間割</h1>
          </div>
          <button class="btn btn-ghost mypage-signout" id="mypage-signout-btn" type="button">ログアウト</button>
        </div>
        ${timetableMarkup(slots, label, hasSaturday)}
      `
    }
  } catch {
    container.innerHTML = `
      <div class="mypage-error">
        <p>時間割の取得に失敗しました。</p>
        <button class="btn btn-ghost" onclick="window.location.reload()">再試行</button>
      </div>
    `
  }
}
