import { guestTimetableMarkup } from './GuestTimetable'

const icons = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18M8 15h3m-3 3h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  sparkles: '<path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3ZM20 2v4m-2-2h4"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
}
const icon = (name: keyof typeof icons) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`

export function studentLandingMarkup(): string {
  return `
  <div class="student-portal">
    <a class="student-skip" href="#student-main">本文へ移動</a>
    <header class="student-header">
      <div class="student-header-left">
        <a class="student-brand" href="/student" aria-label="青山ハック 学生向けトップ">
          <span class="student-brand-name">青山ハック</span><span class="student-brand-label">for students</span>
        </a>
        <a class="student-nav-login" href="/mypage#timetable">ログインして時間割を同期 ${icon('arrow')}</a>
      </div>
      <nav class="student-nav" aria-label="学生向けメニュー">
        <a href="/mypage#timetable">${icon('calendar')}<span>時間割</span></a>
        <a href="/mypage#syllabus">${icon('search')}<span>授業検索</span></a>
      </nav>
    </header>

    <main id="student-main" class="student-main">
      <section class="student-timetable-first" aria-labelledby="student-title">
        <h1 id="student-title">時間割</h1>
        <p class="student-timetable-note">ログインすると、アプリに登録した授業が表の中に入ります。</p>
        ${guestTimetableMarkup()}
      </section>

      <section class="student-shortcuts" aria-label="学習メニュー">
        <a class="student-shortcut" href="/mypage#syllabus">
          <span class="student-shortcut-icon">${icon('search')}</span>
          <div><h2>授業を探す</h2><p>科目名・教員名から、気になる授業を検索。<br>シラバスで授業の内容を確認できます。</p><span class="student-shortcut-link">授業検索へ ${icon('arrow')}</span></div>
        </a>
        <a class="student-shortcut" href="/mypage#timetable">
          <span class="student-shortcut-icon">${icon('sparkles')}</span>
          <div><h2>授業AIで学ぶ <span class="student-pilot-badge">試験提供</span></h2><p>授業の資料を送って、疑問を質問。<br>時間割から授業・授業回を選んではじめます。</p><span class="student-shortcut-link">授業を選ぶ ${icon('arrow')}</span><small>AI機能は、現在許可されたアカウントで利用できます。</small></div>
        </a>
      </section>

      <div class="student-return-note"><span class="student-note-line" aria-hidden="true"></span><p>アプリで使っているアカウントで、そのまま。<br><span>新しくアカウントを作る必要はありません。</span></p></div>
    </main>
    <footer class="student-footer">
      <p>青山ハック <span>学生向けWeb</span></p>
      <nav aria-label="サイト情報"><a href="/privacy-policy">プライバシーポリシー</a><a href="/terms">利用規約</a><a href="https://www.aoyamahack.com/">運営・企業の方へ ${icon('arrow')}</a></nav>
    </footer>
  </div>`
}

export function renderStudentLanding(): void {
  document.title = '青山ハック | 学生向けWeb'
  document.querySelector('meta[name="description"]')?.setAttribute('content', '青学生のための学習スペース。時間割、授業検索、授業AIをブラウザから。')
  // This entry is for review. Connecting an app subdomain is a separate hosting change.
  document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex,nofollow')
  document.querySelector('link[rel="canonical"]')?.remove()
  document.querySelector('script[type="application/ld+json"]')?.remove()
  const metadata = {
    'og:title': document.title,
    'og:description': '時間割も、授業の資料も、AIとの対話も。青学生のための学習スペース。',
    'og:url': location.origin + location.pathname,
  }
  for (const [property, content] of Object.entries(metadata)) document.querySelector(`meta[property="${property}"]`)?.setAttribute('content', content)
  document.querySelector('#app')!.innerHTML = studentLandingMarkup()
}
