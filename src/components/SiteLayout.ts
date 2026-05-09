import { APP_STORE_URL } from '../constants/links'
import { SITE_SHELL_ID } from './SplashScreen'

const navItems = [
  { href: '/about', label: 'About' },
  { href: '/app', label: 'App' },
  { href: '/media', label: 'Media' },
  { href: '/business', label: 'Business' },
  { href: '/recruit', label: 'Recruit' },
  { href: '/contact', label: 'Contact' },
]

const socialLinks = [
  {
    href: 'https://x.com/aogakuhack',
    label: 'X',
    icon: '<svg class="x-logo-icon" viewBox="0 0 1200 1227" aria-hidden="true"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"/></svg>',
  },
  {
    href: 'https://www.instagram.com/aoyama.hack/',
    label: 'Instagram',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="7" r="1"/></svg>',
  },
  {
    href: 'https://www.tiktok.com/@aogakuhack',
    label: 'TikTok',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4v10.2a4 4 0 1 1-4-4"/><path d="M14 4c1 3 2.8 4.8 6 5"/></svg>',
  },
]

const pages: Record<string, { title: string; description: string; legal?: boolean }> = {
  '/about': { title: 'About', description: '青山ハックについて' },
  '/app': { title: 'App', description: '青山ハックのアプリについて' },
  '/media': { title: 'Media', description: '青山ハックのメディア活動について' },
  '/business': { title: 'Business', description: '企業向けの提携・掲載・PRについて' },
  '/recruit': { title: 'Recruit', description: '一緒に活動するメンバーを募集しています' },
  '/contact': { title: 'Contact', description: 'お問い合わせはこちら' },
  '/privacy-policy': { title: 'プライバシーポリシー', description: '青山ハックにおけるユーザー情報および個人情報の取扱いについて', legal: true },
  '/terms': { title: '利用規約', description: '青山ハックの利用条件について', legal: true },
}

const appFeatures = [
  { title: 'シラバス検索', description: '学部、学科、曜日、時限、キャンパス、<br>キーワードなどで検索できます。' },
  { title: '時間割', description: '自分の授業を登録して、<br>毎週の予定を見やすく管理できます。' },
  { title: '学事暦', description: '祝日授業、休講日、補講日などを<br>分かりやすく確認できます。' },
  { title: '単位管理', description: '卒業要件や取得単位の管理に<br>つなげられる機能を整備しています。' },
  { title: 'サークル情報', description: 'サークル・部活情報を探して、<br>活動内容や募集状況を確認できます。' },
  { title: 'お知らせ', description: '青学生向けの便利情報や<br>重要なお知らせをまとめて確認できます。' },
]

const mediaGenres = ['学生生活', '履修・授業', '新歓・サークル', 'グルメ・周辺情報', 'キャリア・インターン', '青学生向けエンタメ']

const mediaMetrics = [
  { value: '9,000+', label: 'SNSフォロワー' },
  { value: 'SNS発信中', label: 'Instagram / TikTok / X' },
  { value: 'アプリ連動', label: '投稿から利用導線へ' },
  { value: '学生発信', label: '現役青学生が企画' },
]

const popularPosts = [
  {
    category: 'Instagram Reel',
    title: '青山ハック リール投稿',
    description: '青学生向けの情報を短く見やすく届けるリール投稿。',
    platform: 'Reelを見る',
    href: 'https://www.instagram.com/reel/DSheCd_ExRs/?igsh=aXN2NTZsbmpkcTM4',
    image: '/screenshots/popular-reel.png',
  },
  {
    category: 'Instagram Feed',
    title: '悩みがちな履修登録について、青学生に向けたわかりやすい情報を発信',
    description: '履修登録で迷いやすいポイントを、青学生がすぐ確認できる形でまとめています。',
    platform: '投稿を見る',
    href: 'https://www.instagram.com/p/DWp17Htk4P-/?igsh=eTNpa3prM3dtNnN6',
    image: '/screenshots/popular-drop.png',
  },
  {
    category: 'Instagram Feed',
    title: '青学のサークル・部活についてSNSでも情報発信中',
    description: 'サークル・部活動の雰囲気や募集情報を、SNSでも見つけやすく発信しています。',
    platform: '投稿を見る',
    href: 'https://www.instagram.com/p/DU5SSHvk7vL/?igsh=bGI3MWhwYWppMG4z',
    image: '/screenshots/popular-ai.png',
  },
]

const mediaStrengths = [
  '青学生に特化している',
  '現役学生が運営している',
  '学生の関心に合わせて自然に届けられる',
  'SNSだけでなく、アプリやイベントにも接点がある',
  '広告感を抑えた発信ができる',
]

const businessProblems = [
  { title: '青学生に認知されたい', description: 'SNS・アプリで自然に届ける' },
  { title: '長期インターンを集めたい', description: '学生向けに分かりやすく求人を紹介' },
  { title: 'イベントに集客したい', description: '投稿・ストーリー・アプリ内導線で告知' },
  { title: '若者向けPRをしたい', description: '学生目線の企画・動画で発信' },
  { title: '学生の声を知りたい', description: 'アンケート・ヒアリングを実施' },
]

const businessServices = [
  { title: 'SNS掲載', description: 'Instagram投稿、ストーリー、TikTok動画など' },
  { title: 'アプリ内掲載', description: 'バナー、記事、特集ページ、通知導線' },
  { title: '採用広報支援', description: '長期インターン、新卒採用、説明会集客' },
  { title: 'タイアップ企画', description: '学生向けキャンペーンや企画投稿' },
  { title: 'イベント集客', description: '学内外イベントへの送客' },
  { title: '学生調査', description: 'アンケート、ヒアリング、インサイト収集' },
]

const businessPrices = [
  { title: 'SNSライト掲載', description: 'ストーリー・フィード投稿など', price: '内容に応じて相談' },
  { title: 'タイアップ投稿', description: '企画設計、投稿制作、レポート', price: '個別にご提案' },
  { title: '採用広報プラン', description: '求人紹介、説明会集客、<br>学生導線設計', price: '目的に応じて設計' },
  { title: 'カスタムプラン', description: 'イベント、アプリ掲載、<br>調査など', price: '個別見積' },
]

const businessFlow = ['お問い合わせ', 'ヒアリング', '企画・見積もり', '内容確認', '投稿・掲載・実施', 'レポート提出']

const businessTrust = [
  '投稿前に企業確認あり',
  '表現チェックあり',
  'ステルスマーケティング対策',
  '画像・ロゴ使用確認',
  '個人情報の取り扱い',
  '炎上リスクへの配慮',
  '請求・契約対応',
]

const recruitRoles = [
  { title: '開発', description: 'iOS、Web、Firebase、データ管理' },
  { title: 'デザイン', description: 'UI、バナー、投稿デザイン' },
  { title: 'SNS運用', description: 'Instagram、TikTok、企画、撮影、編集' },
  { title: '営業・企画', description: '企業連携、イベント企画、提案' },
  { title: 'ライター', description: '記事、紹介文、インタビュー' },
  { title: 'イベント運営', description: '履修相談会、新歓、学内企画' },
]

const recruitFit = [
  '青学をもっと便利にしたい人',
  'アプリやメディア運営に興味がある人',
  'SNSや動画制作をやってみたい人',
  '企業案件や営業に関わってみたい人',
  '学生のうちに事業づくりを経験したい人',
]

const contactTypes = [
  '企業提携について',
  '採用広報・PR掲載について',
  'アプリについて',
  'サークル掲載について',
  'メディア掲載について',
  'その他',
]

const appStoreAttrs = `href="${APP_STORE_URL}" target="_blank" rel="noopener noreferrer"`

const mobileBreak = '<br class="mobile-line-break" />'

const renderInfoCards = (items: { title: string; description: string }[], className = '') =>
  `<div class="info-grid ${className}">${items
    .map(
      ({ title, description }) => `
        <article class="info-card">
          <h3>${title}</h3>
          <p>${description}</p>
        </article>
      `
    )
    .join('')}</div>`

const renderTagList = (items: string[], className = '') =>
  `<div class="tag-list ${className}">${items.map((item) => `<span>${item}</span>`).join('')}</div>`

const renderPopularPosts = () =>
  `<div class="popular-post-grid">${popularPosts
    .map(
      ({ category, title, description, platform, href, image }) => `
        <a class="popular-post-card" href="${href}" target="_blank" rel="noopener noreferrer">
          ${
            image
              ? `<img class="popular-post-image" src="${image}" alt="${title}" loading="lazy" />`
              : `<div class="popular-post-placeholder"><span>Reel</span><strong>青山ハック</strong></div>`
          }
          <div class="popular-post-body">
            <span>${category}</span>
            <h3>${title}</h3>
            <p>${description}</p>
            <small>${platform}</small>
          </div>
        </a>
      `
    )
    .join('')}</div>`

const renderStepList = (items: string[]) =>
  `<div class="step-list step-list-${items.length}">${items.map((item, index) => `<div class="step-card"><span>${index + 1}</span><strong>${item}</strong></div>`).join('')}</div>`

const headerMarkup = (pathname: string) => `
  <header class="site-header">
    <a class="brand" href="/">青山ハック</a>
    <button class="menu-toggle" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="site-menu" data-menu-toggle>
      <span></span><span></span><span></span>
    </button>
  </header>
  <div id="site-menu" class="menu-panel" aria-hidden="true" data-menu-panel>
    <div class="menu-card" role="dialog" aria-modal="true" aria-label="サイトメニュー">
      <button class="menu-close" type="button" aria-label="メニューを閉じる" data-menu-close>
        <span></span><span></span>
      </button>
      <p class="menu-brand">青山ハック</p>
      <nav class="menu-nav" aria-label="Main navigation">
        ${navItems
          .map(({ href, label }) => `<a${pathname === href ? ' class="is-active" aria-current="page"' : ''} href="${href}">${label}</a>`)
          .join('')}
      </nav>
      <a class="btn btn-menu-download" ${appStoreAttrs}>アプリをダウンロード</a>
      <div class="menu-sub-links">
        <a href="/privacy-policy">プライバシーポリシー</a>
        <a href="/terms">利用規約</a>
      </div>
      <div class="menu-social">
        ${socialLinks.map(({ href, label, icon }) => `<a class="social-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${icon}</a>`).join('')}
      </div>
    </div>
  </div>
`

const footerMarkup = `
  <footer>
    <p class="brand">青山ハック</p>
    <div class="links">
      <a href="/privacy-policy">プライバシーポリシー</a>
      <a href="/terms">利用規約</a>
    </div>
    <div class="sns">
      ${socialLinks.map(({ href, label, icon }) => `<a class="social-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${icon}</a>`).join('')}
    </div>
  </footer>
`

const landingMarkup = `
  <main>
    <section id="top" class="hero reveal">
      <div class="hero-copy">
        <h1 class="hero-title">
          <span class="hero-title-line">青学の学生生活を、</span>
          <span class="hero-title-line">もっと使いやすく。</span>
        </h1>
        <p>シラバス検索、時間割、学生生活をひとつに。毎日の学びを軽やかに支える学生プラットフォーム。</p>
        <div class="hero-actions">
          <a class="btn btn-primary" ${appStoreAttrs}>アプリをダウンロード</a>
          <a class="btn btn-ghost" href="/app">機能を見る</a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="phone-mock hero-phone">
          <div class="phone-screen">
            <div class="phone-screen-media hero-screen-media" style="--screen-image: url('/screenshots/hero.png')" aria-hidden="true"></div>
            <div class="app-screen-preview screen-fallback">
              <div class="phone-status"></div>
              <div class="app-screen-header">
                <span>青山ハック</span>
                <strong>今日の青学生活</strong>
              </div>
              <div class="app-search-preview"></div>
              <div class="app-card-preview primary"></div>
              <div class="app-card-preview"></div>
              <div class="app-card-preview compact"></div>
            </div>
          </div>
        </div>
        <span class="float-dot d1"></span><span class="float-dot d2"></span><span class="float-dot d3"></span>
      </div>
    </section>

    <section id="app" class="feature feature-search reveal">
      <div class="feature-copy">
        <p class="eyebrow">Feature 01</p>
        <h2 class="split-heading">
          <span>探して、</span>
          <span>すぐ見つかる。</span>
          <span>シラバス検索</span>
        </h2>
        <p>必要な条件だけ選んで、今の自分に合う授業を迷わず見つける。</p>
        <div class="chips"><span>学部・学科</span><span>キャンパス</span><span>前期 / 後期</span><span>対面 / オンライン</span><span>キーワード</span></div>
      </div>
      <div class="feature-phone-stack syllabus-phone-stack">
        <div class="phone-mock feature-phone">
          <div class="phone-screen">
            <div class="phone-screen-media syllabus-screen-media-1" style="--screen-image: url('/screenshots/syllabus-1.png')" aria-hidden="true"></div>
            <div class="app-screen-preview screen-fallback syllabus-fallback">
              <div class="app-search-preview"></div>
              <div class="app-card-preview"></div>
              <div class="app-card-preview"></div>
              <div class="app-card-preview compact"></div>
            </div>
          </div>
        </div>
        <div class="phone-mock feature-phone feature-phone-small">
          <div class="phone-screen">
            <div class="phone-screen-media syllabus-screen-media-2" style="--screen-image: url('/screenshots/syllabus-2.png')" aria-hidden="true"></div>
            <div class="app-screen-preview screen-fallback syllabus-fallback">
              <div class="app-card-preview primary"></div>
              <div class="app-card-preview"></div>
              <div class="app-card-preview compact"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="feature feature-share reveal">
      <div class="feature-copy">
        <p class="eyebrow mint">Feature 02</p>
        <h2 class="split-heading feature-share-heading">
          <span>時間割を共有して、</span>
          <span>友だちとつながる。</span>
        </h2>
        <p>空きコマ比較や予定合わせで、キャンパスライフをもっとスムーズに。</p>
      </div>
      <div class="share-visual">
        <div class="phone-mock tall">
          <div class="phone-screen">
            <div class="phone-screen-media timetable-screen-media-1" style="--screen-image: url('/screenshots/timetable-1.jpg')" aria-hidden="true"></div>
            <div class="app-screen-preview screen-fallback timetable-fallback">
              <div class="app-card-preview primary"></div>
              <div class="app-card-preview"></div>
              <div class="app-card-preview"></div>
            </div>
          </div>
        </div>
        <div class="phone-mock small">
          <div class="phone-screen">
            <div class="phone-screen-media timetable-screen-media-2" style="--screen-image: url('/screenshots/timetable-2.png')" aria-hidden="true"></div>
            <div class="app-screen-preview screen-fallback timetable-fallback">
              <div class="app-search-preview"></div>
              <div class="app-card-preview"></div>
              <div class="app-card-preview compact"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="feature feature-clubs reveal">
      <div class="feature-copy">
        <p class="eyebrow sky">Feature 03</p>
        <h2 class="split-heading feature-clubs-heading">
          <span>サークル・部活動を、</span>
          <span>もっと身近に。</span>
        </h2>
        <p>活動内容や雰囲気、募集情報をまとめてチェック。自分に合うコミュニティとの出会いを後押しします。</p>
        <div class="chips"><span>サークル</span><span>部活動</span><span>新歓</span><span>活動日</span><span>タグ検索</span></div>
      </div>
      <div class="club-phone-visual">
        <div class="phone-mock club-phone">
          <div class="phone-screen">
            <div class="phone-screen-media clubs-screen-media" style="--screen-image: url('/screenshots/clubs.png')" aria-hidden="true"></div>
            <div class="app-screen-preview screen-fallback clubs-fallback">
              <div class="club-app-header">
                <span>Club & Circle</span>
                <strong>サークル・部活動</strong>
              </div>
              <div class="club-search-bar"></div>
              <div class="club-card-preview featured"><strong>Aoyama Sports</strong><small>週3 / 青山キャンパス</small></div>
              <div class="club-card-preview"><strong>Music Circle</strong><small>新歓受付中</small></div>
              <div class="club-card-preview compact"><strong>Volunteer Team</strong></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="media" class="expand reveal">
      <div class="section-head">
        <p class="eyebrow">青山ハックのこれから</p>
        <h2>アプリだけじゃない。青学のリアルを届ける。</h2>
      </div>
      <div class="expand-grid">
        <a class="expand-card" href="/media"><h3>Media</h3><p>青学の“今”を発信。</p><span>→</span></a>
        <a class="expand-card" href="/business"><h3>Business</h3><p>企業と青学生の接点づくり。</p><span>→</span></a>
        <a class="expand-card" href="/recruit"><h3>Recruit</h3><p>一緒につくる仲間を募集。</p><span>→</span></a>
        <a class="expand-card" href="/contact"><h3>Contact</h3><p>ご意見・ご要望はこちら。</p><span>→</span></a>
      </div>
      <div class="metrics card">
        <div><strong>6,000+</strong><small>累計DL数</small></div>
        <div><strong>9,000+</strong><small>SNSフォロワー</small></div>
        <div><strong>5,000+</strong><small>利用学生数</small></div>
      </div>
      <div class="cta-row">
        <a class="btn btn-primary" ${appStoreAttrs}>アプリをダウンロード</a>
        <a class="btn btn-ghost" href="/contact">お問い合わせ</a>
      </div>
    </section>
  </main>
`

const aboutPageMarkup = `
  <main class="page-main">
    <section class="content-page reveal">
      <div class="page-hero">
        <p class="eyebrow">About</p>
        <h1 class="split-title">
          <span>学生生活の不便を、</span>
          <span>学生目線で解決する。</span>
        </h1>
        <p>青山ハックは、青学生の学生生活をより便利にするために、現役学生が運営する学生生活支援プラットフォームです。シラバス検索、時間割、学事暦、SNS発信などを通じて、青学生の日常に役立つ情報を届けています。</p>
      </div>
      ${renderInfoCards([
        { title: 'ミッション', description: '青学生が日々感じる小さな不便を、アプリ・メディア・イベントを通じて使いやすい体験に変えていきます。' },
        { title: '運営体制', description: '企画、開発、デザイン、SNS、営業まで、現役学生を中心としたチームで運営しています。' },
        { title: '非公式サービス', description: '青山ハックは大学公式ではなく、学生が自主的に運営する非公式の学生生活支援サービスです。' },
      ])}
      <section class="section-card">
        <h2>成長の歩み</h2>
        <div class="timeline">
          <div><span>Start</span><p>履修や学生生活の情報をもっと探しやすくするために活動開始。</p></div>
          <div><span>App</span><p>シラバス検索、時間割、学事暦などをひとつにまとめたアプリを展開。</p></div>
          <div><span>Now</span><p>SNSやコミュニティ施策も組み合わせ、青学生に届く接点を広げています。</p></div>
        </div>
      </section>
    </section>
  </main>
`

const appPageMarkup = `
  <main class="page-main">
    <section class="content-page reveal">
      <div class="page-hero two-column">
        <div>
          <p class="eyebrow">App</p>
          <h1 class="mobile-balanced-title">青学生の毎日を、${mobileBreak}ひとつのアプリで${mobileBreak}軽くする。</h1>
          <p>履修、時間割、学事暦、サークル情報まで。${mobileBreak}青学生がよく使う情報をまとめて、${mobileBreak}迷わずアクセスできる体験を目指しています。</p>
          <div class="page-actions left">
            <a class="btn btn-primary" ${appStoreAttrs}>アプリをダウンロード</a>
            <a class="btn btn-ghost" href="#features">機能を見る</a>
          </div>
        </div>
        <div class="page-phone-preview">
          <div class="phone-mock page-phone">
            <div class="phone-screen">
              <div class="phone-screen-media app-page-screen-media" style="--screen-image: url('/screenshots/hero.png')" aria-hidden="true"></div>
              <div class="app-screen-preview">
                <div class="phone-status"></div>
                <div class="app-screen-header"><span>青山ハック</span><strong>今日の青学生活</strong></div>
                <div class="app-search-preview"></div>
                <div class="app-card-preview primary"></div>
                <div class="app-card-preview"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <section id="features" class="section-card">
        <div class="section-title-row"><h2>主な機能</h2></div>
        ${renderInfoCards(appFeatures)}
      </section>
      <section class="quote-card">
        <p class="quote-text-desktop">「履修登録や時間割確認の行き来が減って、<br />授業探しがかなり楽になりました。」</p>
        <p class="quote-text-mobile">「履修登録や時間割確認の<br />行き来が減って、<br />授業探しがかなり<br />楽になりました。」</p>
        <span>青学生の声</span>
      </section>
    </section>
  </main>
`

const mediaPageMarkup = `
  <main class="page-main">
    <section class="content-page reveal">
      <div class="page-hero">
        <p class="eyebrow">Media</p>
        <h1 class="mobile-balanced-title media-page-title">青学生に届く${mobileBreak}メディアとして、${mobileBreak}日常に自然に${mobileBreak}入り込む。</h1>
        <p class="split-lead">
          <span>Instagram、TikTok、YouTube、X、アプリ内配信、イベントや口コミ導線を組み合わせ、</span>
          <span>学生生活に必要な情報を継続的に届けています。</span>
        </p>
      </div>
      <section class="section-card">
        <div class="section-title-row"><h2>発信ジャンル</h2><p>履修から新歓、周辺情報まで、青学生の関心に合わせて企画します。</p></div>
        ${renderTagList(mediaGenres)}
      </section>
      <div class="metric-grid">
        ${mediaMetrics.map(({ value, label }) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('')}
      </div>
      <section class="section-card">
        <div class="section-title-row"><h2>人気投稿</h2></div>
        ${renderPopularPosts()}
      </section>
      <section class="section-card">
        <h2>メディアの強み</h2>
        ${renderTagList(mediaStrengths, 'trust-tags')}
      </section>
    </section>
  </main>
`

const businessPageMarkup = `
  <main class="page-main">
    <section class="content-page reveal">
      <div class="page-hero business-hero">
        <p class="eyebrow">Business</p>
        <h1 class="mobile-balanced-title">青学生に届く${mobileBreak}採用・PRを、${mobileBreak}学生目線で${mobileBreak}設計します。</h1>
        <p class="split-lead">
          <span>アプリ・SNS・イベントを活用し、${mobileBreak}企業と青学生の接点づくりを支援します。</span>
          <span>採用広報、サービスPR、イベント集客、${mobileBreak}学生調査まで、目的に合わせて設計します。</span>
        </p>
        <div class="page-actions">
          <a class="btn btn-primary btn-business-contact" href="/contact">媒体資料・提携について相談する</a>
        </div>
      </div>
      <section class="section-card">
        <div class="section-title-row"><h2>解決できる課題</h2><p>青学生に特化した導線で、認知から行動までを設計します。</p></div>
        ${renderInfoCards(businessProblems)}
      </section>
      <section class="section-card">
        <div class="section-title-row"><h2>提供メニュー</h2><p>SNS、アプリ、イベント、調査を組み合わせて実施できます。</p></div>
        ${renderInfoCards(businessServices)}
      </section>
      <section class="section-card">
        <div class="section-title-row"><h2>料金について</h2><p class="one-line-note">具体的な金額は掲載内容や実施範囲を確認したうえで、個別にご提案します。</p></div>
        <div class="price-grid">
          ${businessPrices.map(({ title, description, price }) => `<article class="price-card"><h3>${title}</h3><p>${description}</p><strong>${price}</strong></article>`).join('')}
        </div>
      </section>
      <section class="section-card">
        <div class="section-title-row"><h2>実施フロー</h2><p>お問い合わせから実施後のレポートまで、確認しながら進めます。</p></div>
        ${renderStepList(businessFlow)}
      </section>
      <section class="section-card">
        <div class="section-title-row"><h2>安心して相談いただくために</h2><p>企業確認や表現チェックを行い、学生向け発信として自然で誠実な形を整えます。</p></div>
        ${renderTagList(businessTrust, 'trust-tags')}
      </section>
    </section>
  </main>
`

const recruitPageMarkup = `
  <main class="page-main">
    <section class="content-page reveal">
      <div class="page-hero">
        <p class="eyebrow">Recruit</p>
        <h1>メンバー募集</h1>
        <p class="split-lead">
          <span>青山ハックでは、青学生の学生生活をより便利にするために、</span>
          <span>一緒にアプリ・SNS・イベントをつくるメンバーを募集しています。</span>
        </p>
        <div class="page-actions">
          <a class="btn btn-primary" href="#recruit-form">メンバーに応募する</a>
          <a class="btn btn-ghost" href="#recruit-form">話を聞いてみる</a>
        </div>
      </div>
      <section class="section-card">
        <div class="section-title-row"><h2>募集職種</h2><p>得意なことから参加できます。未経験でも相談してください。</p></div>
        ${renderInfoCards(recruitRoles)}
      </section>
      <section class="section-card">
        <div class="section-title-row"><h2>向いている人</h2><p>学生のうちに実践的な事業づくりを経験したい人に向いています。</p></div>
        ${renderTagList(recruitFit)}
      </section>
      <section class="section-card">
        <div class="section-title-row"><h2>応募フロー</h2><p>気軽な相談から始められます。</p></div>
        ${renderStepList(['応募フォーム', 'カジュアル面談', '体験参加', '加入'])}
      </section>
      <section id="recruit-form" class="contact-layout recruit-form-section">
        <form class="contact-form" action="#" method="post" data-recruit-form>
          <p class="form-note wide">応募内容は送信前に確認できます。すべて必須項目です。</p>
          <label class="honeypot-field" aria-hidden="true">Webサイト<input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
          <label>氏名 <span>必須</span><input type="text" name="name" autocomplete="name" required /></label>
          <label>読み仮名 <span>必須</span><input type="text" name="kana" required /></label>
          <label>InstagramアカウントID <span>必須</span><input type="text" name="instagram" placeholder="@aoyama.hack" required /></label>
          <label>学校・学部・学科 <span>必須</span><input type="text" name="school" placeholder="例：青山学院大学 経営学部 経営学科" required /></label>
          <label>学年 <span>必須</span>
            <select name="grade" required>
              <option value="">選択してください</option>
              <option value="1年">1年</option>
              <option value="2年">2年</option>
              <option value="3年">3年</option>
              <option value="4年">4年</option>
              <option value="大学院生">大学院生</option>
              <option value="その他">その他</option>
            </select>
          </label>
          <label>取り組みたいこと <span>必須</span>
            <select name="interest" required>
              <option value="">選択してください</option>
              <option value="広報">広報</option>
              <option value="UIデザイン">UIデザイン</option>
              <option value="開発">開発</option>
              <option value="複数領域に興味がある">複数領域に興味がある</option>
            </select>
          </label>
          <label class="wide">あなたが考える長所 <span>必須</span><textarea name="strength" rows="4" required></textarea></label>
          <label class="wide">あなたが考える短所 <span>必須</span><textarea name="weakness" rows="4" required></textarea></label>
          <label class="wide">アピールポイント <span>必須</span><textarea name="appeal" rows="5" required></textarea></label>
          <p class="privacy-notice wide">送信いただいた情報は、青山ハックのメンバー募集に関する連絡・選考・運営上の確認のために利用します。<br>個人情報の取り扱いについては<a href="/privacy-policy">プライバシーポリシー</a>をご確認ください。</p>
          <label class="privacy-consent wide">
            <input type="checkbox" name="privacyConsent" required />
            <span class="privacy-consent-text"><a href="/privacy-policy">プライバシーポリシー</a>に同意する</span>
          </label>
          <p class="form-error wide" data-recruit-error aria-live="polite"></p>
          <button class="btn btn-primary wide" type="submit">応募内容を確認する</button>
        </form>
        <div class="contact-confirmation" data-recruit-confirmation hidden>
          <div>
            <p class="eyebrow">確認</p>
            <h2>応募内容の確認</h2>
          </div>
          <dl class="contact-summary" data-recruit-summary></dl>
          <div class="page-actions left">
            <button class="btn btn-ghost" type="button" data-recruit-edit>修正する</button>
            <a class="btn btn-primary" href="#" data-recruit-mailto>最終確認して応募する</a>
          </div>
        </div>
        <aside class="contact-side">
          <h2>応募後の流れ</h2>
          <p>内容を確認し、通常2〜3営業日以内にInstagramまたはメールでご連絡します。</p>
          <h2>募集領域</h2>
          <div class="tag-list trust-tags"><span>広報</span><span>UIデザイン</span><span>開発</span></div>
        </aside>
      </section>
    </section>
  </main>
`

const contactPageMarkup = `
  <main class="page-main">
    <section class="content-page reveal">
      <div class="page-hero">
        <p class="eyebrow">Contact</p>
        <h1>お問い合わせ</h1>
        <p class="contact-hero-lead">
          <span>企業提携、PR掲載、アプリ、サークル掲載など、内容に合わせてご連絡ください。</span>
          <span>通常2〜3営業日以内に返信いたします。</span>
        </p>
      </div>
      <section class="contact-layout">
        <form class="contact-form" action="#" method="post" data-contact-form>
          <p class="form-note wide">必須項目を入力すると、送信前に確認画面で内容をチェックできます。</p>
          <label class="honeypot-field" aria-hidden="true">Webサイト<input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
          <label>名前 <span>必須</span><input type="text" name="name" autocomplete="name" required /></label>
          <label>会社名または所属 <span>必須</span><input type="text" name="organization" autocomplete="organization" required /></label>
          <label>メールアドレス <span>必須</span><input type="email" name="email" autocomplete="email" required /></label>
          <label>問い合わせ種別
            <span>必須</span>
            <select name="type" required>
              ${contactTypes.map((type) => `<option value="${type}">${type}</option>`).join('')}
            </select>
          </label>
          <label class="wide">相談内容 <span>必須</span><textarea name="message" rows="6" required></textarea></label>
          <label>希望実施時期<input type="text" name="timing" placeholder="例：6月中、未定など" /></label>
          <label>予算感<input type="text" name="budget" placeholder="例：10万円前後、未定など" /></label>
          <p class="privacy-notice wide">送信いただいた情報は、お問い合わせへの回答およびご提案のために利用します。<br>個人情報の取り扱いについては<a href="/privacy-policy">プライバシーポリシー</a>をご確認ください。</p>
          <label class="privacy-consent wide">
            <input type="checkbox" name="privacyConsent" required />
            <span class="privacy-consent-text"><a href="/privacy-policy">プライバシーポリシー</a>に同意する</span>
          </label>
          <p class="form-error wide" data-contact-error aria-live="polite"></p>
          <button class="btn btn-primary wide" type="submit">内容を確認する</button>
        </form>
        <div class="contact-confirmation" data-contact-confirmation hidden>
          <div>
            <p class="eyebrow">確認</p>
            <h2>送信内容の確認</h2>
          </div>
          <dl class="contact-summary" data-contact-summary></dl>
          <div class="page-actions left">
            <button class="btn btn-ghost" type="button" data-contact-edit>修正する</button>
            <a class="btn btn-primary" href="#" data-contact-mailto>最終確認して送信する</a>
          </div>
        </div>
        <aside class="contact-side">
          <h2>返信目安</h2>
          <p>通常2〜3営業日以内に返信いたします。</p>
          <h2>SNS</h2>
          <div class="contact-social">
            ${socialLinks.map(({ href, label, icon }) => `<a class="social-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${icon}</a>`).join('')}
          </div>
        </aside>
      </section>
    </section>
  </main>
`

const privacyPolicyMarkup = `
  <article class="legal-document">
    <header class="legal-document-header">
      <p>制定日：2025年9月1日<br>最終更新：2026年5月8日</p>
    </header>
    <p>青山ハック運営（代表者：米沢怜生。以下「運営者」といいます。）は、運営者が提供するアプリ「青山ハック」（以下「本アプリ」といいます。）において取得するユーザー情報および個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。</p>

    <section>
      <h3>第1条　取得する情報</h3>
      <p>本アプリでは、以下の情報を取得することがあります。</p>
      <section>
        <h4>（1）アカウント情報</h4>
        <p>本アプリでは、Firebase Authenticationを利用して、メールアドレスおよびパスワードによる認証を行います。認証に関する情報は、Googleが提供するFirebaseのサーバー上で管理されます。</p>
      </section>
      <section>
        <h4>（2）プロフィール情報</h4>
        <p>ユーザーが入力した表示名、プロフィール画像その他のプロフィール情報を、Firestoreに保存します。</p>
      </section>
      <section>
        <h4>（3）時間割・履修情報</h4>
        <p>ユーザーが登録した履修科目、時間割、課題その他本アプリの機能利用に必要な情報を、Firestoreに保存します。時間割情報は、友だち機能を通じて、ユーザーが承認した他のユーザーに共有されることがあります。</p>
      </section>
      <section>
        <h4>（4）友だち関係に関する情報</h4>
        <p>友だち申請、承認状態、ユーザーID同士の接続情報など、友だち機能の提供に必要な情報をFirestoreに保存します。</p>
      </section>
      <section>
        <h4>（5）通知トークン</h4>
        <p>プッシュ通知を配信するため、Firebase Cloud Messaging（FCM）が発行するデバイストークンを取得・保存することがあります。</p>
      </section>
      <section>
        <h4>（6）画面利用ログ・アナリティクス情報</h4>
        <p>本アプリの改善および利用状況の把握のため、ユーザーが閲覧した画面名、滞在時間、アクセス日時、ユーザーID等の利用ログをFirestoreに記録することがあります。</p>
        <p>また、Firebase Analyticsにより、アプリの起動状況、クラッシュ情報、利用傾向等の統計情報が自動的に収集されることがあります。</p>
        <p>運営者が確認する管理画面では、画面ごとの閲覧数、平均滞在時間、利用傾向等の集計情報を確認します。管理画面上では、メールアドレスや表示名など、直接個人を識別できる情報を表示しないよう努めます。ただし、保存される利用ログにはユーザーIDが含まれる場合があり、アカウント情報等と照合される可能性があるため、完全に匿名の情報とは限りません。</p>
      </section>
      <section>
        <h4>（7）広告識別子</h4>
        <p>本アプリでは、Google AdMobによる広告配信のため、デバイスの広告識別子（IDFA等）が利用される場合があります。</p>
      </section>
    </section>

    <section>
      <h3>第2条　利用目的</h3>
      <p>運営者は、取得した情報を以下の目的で利用します。</p>
      <ul>
        <li>本アプリの提供、維持、改善のため</li>
        <li>アカウント認証、友だち機能、時間割共有、課題管理、プッシュ通知等の機能を提供するため</li>
        <li>ユーザーからのお問い合わせに対応するため</li>
        <li>画面ごとの利用状況を分析し、UX改善や機能改善に役立てるため</li>
        <li>不正利用、規約違反、セキュリティ上の問題を防止・調査するため</li>
        <li>Google AdMobを通じた広告配信のため</li>
        <li>法令またはガイドラインに基づく対応のため</li>
      </ul>
    </section>

    <section>
      <h3>第3条　第三者提供</h3>
      <p>運営者は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。</p>
      <p>ただし、本アプリでは以下の外部サービスを利用しており、各サービスの提供者が定めるプライバシーポリシー等が適用される場合があります。</p>
      <ul>
        <li>Firebase（Google LLC）：認証、データベース、通知、アナリティクス<br><a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">https://firebase.google.com/support/privacy</a></li>
        <li>Google AdMob（Google LLC）：広告配信<br><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a></li>
      </ul>
    </section>

    <section>
      <h3>第4条　情報の管理</h3>
      <p>運営者は、取得した情報について、不正アクセス、紛失、破壊、改ざん、漏えい等を防止するため、合理的な安全管理措置を講じるよう努めます。</p>
      <p>Firestoreに保存される情報については、Firestoreセキュリティルール等により、認証済みユーザーが自身のデータにアクセスできるよう制限します。また、管理者向けの画面やデータベースへのアクセスについては、必要な権限を有する者に限定するよう努めます。</p>
      <p>ただし、インターネット上の通信およびクラウドサービスの利用に関して、完全な安全性を保証するものではありません。</p>
    </section>

    <section>
      <h3>第5条　情報の保存期間および削除</h3>
      <p>ユーザーがアカウントを削除した場合、運営者は、Firestoreに保存されたプロフィール情報、時間割情報、友だち関係、通知トークン、利用ログ等を、合理的な期間内に削除するよう努めます。</p>
      <p>ただし、Firebase Analytics等により収集された統計情報、バックアップ、または外部サービス上で保持される情報については、各サービスのデータ保持ポリシーに従う場合があります。</p>
      <p>画面利用ログについては、本アプリの改善および不正利用防止のため、必要な期間保存する場合があります。保存期間経過後は、削除または個人を識別できない形に加工したうえで利用することがあります。</p>
    </section>

    <section>
      <h3>第6条　ユーザーによる確認・訂正・削除等</h3>
      <p>ユーザーは、運営者に対し、自己に関する個人情報の確認、訂正、削除、利用停止等を求めることができます。</p>
      <p>これらの請求を希望する場合は、本アプリ内のお問い合わせフォームまたは本ポリシー末尾の連絡先までご連絡ください。運営者は、本人確認を行ったうえで、法令に基づき合理的な範囲で対応します。</p>
    </section>

    <section>
      <h3>第7条　未成年者の利用</h3>
      <p>本アプリは、主に青山学院大学の学生を対象としています。18歳未満の方が本アプリを利用する場合は、保護者の同意を得たうえで利用してください。</p>
    </section>

    <section>
      <h3>第8条　本ポリシーの変更</h3>
      <p>運営者は、必要に応じて本ポリシーを変更することがあります。重要な変更を行う場合は、本アプリ内での通知その他適切な方法によりお知らせします。</p>
    </section>

    <section>
      <h3>第9条　お問い合わせ</h3>
      <p>本ポリシーおよび個人情報の取扱いに関するお問い合わせは、本アプリ内のお問い合わせフォームまたは以下の連絡先までご連絡ください。</p>
      <p>運営者：青山ハック運営<br>代表者：米沢怜生<br>連絡先：<a href="mailto:forta.2k25@gmail.com">forta.2k25@gmail.com</a></p>
    </section>
  </article>
`

const termsMarkup = `
  <article class="legal-document">
    <header class="legal-document-header">
      <p>制定日：2025年9月1日<br>最終更新：2026年5月8日</p>
    </header>
    <p>この利用規約（以下「本規約」といいます。）は、青山ハック運営（代表者：米沢怜生。以下「運営者」といいます。）が提供するアプリ「青山ハック」（以下「本アプリ」といいます。）の利用条件を定めるものです。</p>
    <p>ユーザーは、本アプリをインストールまたは利用することにより、本規約に同意したものとみなされます。</p>

    <section>
      <h3>第1条　サービスの内容</h3>
      <p>本アプリは、青山学院大学の学生向けに、時間割管理、友だち機能、サークル情報、課題管理、Moodle等の外部サービスへのアクセス補助その他学生生活に関連する情報・機能を提供します。</p>
      <p>本アプリは、青山学院大学またはその関連組織が公式に提供するサービスではありません。</p>
    </section>

    <section>
      <h3>第2条　アカウント</h3>
      <p>（1）本アプリの一部機能を利用するには、アカウント登録が必要です。</p>
      <p>（2）ユーザーは、登録情報を正確かつ最新の状態に保つものとします。</p>
      <p>（3）アカウントの管理は、ユーザー自身の責任で行うものとします。</p>
      <p>（4）第三者による不正利用が判明した場合、ユーザーは速やかに運営者に連絡するものとします。</p>
      <p>（5）運営者は、ユーザーが本規約に違反した場合、または運営者が不適切と判断した場合、事前の通知なくアカウントの利用停止、削除、または本アプリの利用制限を行うことができます。</p>
    </section>

    <section>
      <h3>第3条　友だち機能</h3>
      <p>（1）ユーザーは、友だち申請および承認を行うことで、相互に時間割情報を閲覧できるようになります。</p>
      <p>（2）友だち関係は、ユーザーの操作によりいつでも解除できます。</p>
      <p>（3）友だち関係を解除した場合、解除後は相手の時間割情報を閲覧できなくなります。</p>
      <p>（4）ユーザーは、友だち機能を利用して、不正な情報収集、嫌がらせ、ハラスメント、なりすましその他不適切な行為をしてはなりません。</p>
    </section>

    <section>
      <h3>第4条　外部サービスへのアクセス</h3>
      <p>本アプリは、Moodleその他の外部サービスへのアクセスを補助する機能を提供する場合があります。</p>
      <p>外部サービスの利用については、それぞれのサービス提供者が定める利用規約、プライバシーポリシーその他の条件が適用されます。運営者は、外部サービスの内容、利用可否、正確性、安全性、継続性等について保証しません。</p>
    </section>

    <section>
      <h3>第5条　禁止事項</h3>
      <p>ユーザーは、本アプリの利用にあたり、以下の行為をしてはなりません。</p>
      <ul>
        <li>法令または公序良俗に反する行為</li>
        <li>他のユーザー、第三者、運営者に不利益、損害、不快感を与える行為</li>
        <li>他のユーザーへの嫌がらせ、誹謗中傷、ハラスメント行為</li>
        <li>虚偽の情報を登録または送信する行為</li>
        <li>他人になりすまして本アプリを利用する行為</li>
        <li>本アプリのシステム、サーバー、ネットワーク等への不正アクセス、改ざん、解析、過度な負荷を与える行為</li>
        <li>本アプリを通じて取得した情報を、不正な目的または第三者に迷惑を与える目的で利用する行為</li>
        <li>運営者の許可なく、本アプリを商業目的で利用する行為</li>
        <li>本アプリの運営を妨害する行為</li>
        <li>その他、運営者が不適切と判断する行為</li>
      </ul>
    </section>

    <section>
      <h3>第6条　知的財産権</h3>
      <p>本アプリに関する著作権、商標権その他の知的財産権は、運営者または正当な権利を有する第三者に帰属します。</p>
      <p>ユーザーが本アプリ上に登録または投稿したプロフィール画像その他のコンテンツについては、ユーザーまたは正当な権利者が権利を保持します。ただし、ユーザーは、運営者に対し、本アプリの提供、表示、保存、改善、運営上必要な範囲で当該コンテンツを利用することを許諾するものとします。</p>
    </section>

    <section>
      <h3>第7条　サービスの変更・停止・終了</h3>
      <p>運営者は、必要に応じて、本アプリの全部または一部の内容を変更、追加、停止、終了することができます。</p>
      <p>運営者は、可能な範囲で事前に告知するよう努めますが、緊急の場合、技術上または運営上必要な場合には、事前の告知なく本アプリの提供を変更、停止、終了することがあります。</p>
    </section>

    <section>
      <h3>第8条　免責事項</h3>
      <p>（1）運営者は、本アプリの内容、情報の正確性、完全性、有用性、特定の目的への適合性について保証しません。</p>
      <p>（2）運営者は、本アプリの利用によりユーザーに生じた損害について、運営者の故意または重過失による場合を除き、責任を負いません。</p>
      <p>（3）ユーザー間またはユーザーと第三者との間で生じたトラブルについては、当事者間で解決するものとし、運営者は、運営者の故意または重過失による場合を除き、責任を負いません。</p>
      <p>（4）システム障害、通信環境の不具合、メンテナンス、天災、外部サービスの仕様変更その他運営者の責めに帰すことができない事由により本アプリの利用ができなかった場合、運営者は責任を負いません。</p>
      <p>（5）本アプリを通じてアクセスできる外部サービスについては、各サービス提供者の規約および方針が適用されます。</p>
    </section>

    <section>
      <h3>第9条　ユーザーの責任</h3>
      <p>ユーザーは、自身の責任において本アプリを利用するものとします。</p>
      <p>ユーザーが本規約に違反し、または本アプリの利用に関連して運営者または第三者に損害を与えた場合、当該ユーザーは自己の責任と費用においてこれを解決するものとします。</p>
    </section>

    <section>
      <h3>第10条　個人情報の取扱い</h3>
      <p>運営者は、本アプリにおける個人情報およびユーザー情報の取扱いについて、別途定めるプライバシーポリシーに従います。</p>
    </section>

    <section>
      <h3>第11条　本規約の変更</h3>
      <p>運営者は、必要に応じて本規約を変更することがあります。重要な変更を行う場合は、本アプリ内での通知その他適切な方法によりお知らせします。</p>
      <p>変更後の本規約は、運営者が別途定める場合を除き、本アプリ内または運営者が指定する場所に掲載された時点から効力を生じるものとします。ユーザーが変更後も本アプリを利用した場合、変更後の本規約に同意したものとみなします。</p>
    </section>

    <section>
      <h3>第12条　準拠法・裁判管轄</h3>
      <p>本規約は日本法に準拠します。</p>
      <p>本アプリに関して運営者とユーザーとの間で紛争が生じた場合、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>
    </section>

    <section>
      <h3>第13条　お問い合わせ</h3>
      <p>本規約に関するお問い合わせは、本アプリ内のお問い合わせフォームまたは以下の連絡先までご連絡ください。</p>
      <p>運営者：青山ハック運営<br>代表者：米沢怜生<br>連絡先：<a href="mailto:forta.2k25@gmail.com">forta.2k25@gmail.com</a></p>
    </section>
  </article>
`

const legalPageMarkup = (page: { title: string; description: string }, pathname: string) => {
  const isPrivacyPolicy = pathname === '/privacy-policy'
  const title = isPrivacyPolicy ? `プライバシー${mobileBreak}ポリシー` : page.title
  const description = isPrivacyPolicy
    ? `青山ハックにおけるユーザー情報${mobileBreak}および個人情報の取扱いについて`
    : page.description

  return `
  <main class="page-main">
    <section class="simple-page legal-page reveal">
      <p class="eyebrow">青山ハック</p>
      <h1 class="${isPrivacyPolicy ? 'privacy-policy-title' : ''}">${title}</h1>
      <p class="${isPrivacyPolicy ? 'privacy-policy-lead' : ''}">${description}</p>
      ${pathname === '/privacy-policy'
        ? privacyPolicyMarkup
        : pathname === '/terms'
          ? termsMarkup
          : `<div class="legal-placeholder">
            <h2>${page.title}</h2>
            <p>ここに内容を記載します。</p>
          </div>`}
      <div class="page-actions">
        <a class="btn btn-ghost" href="/">トップへ戻る</a>
      </div>
    </section>
  </main>
`
}

const pageMarkup = (pathname: string) => {
  if (pathname === '/about') return aboutPageMarkup
  if (pathname === '/app') return appPageMarkup
  if (pathname === '/media') return mediaPageMarkup
  if (pathname === '/business') return businessPageMarkup
  if (pathname === '/recruit') return recruitPageMarkup
  if (pathname === '/contact') return contactPageMarkup

  return legalPageMarkup(pages[pathname] ?? pages['/privacy-policy'], pathname)
}

export const getSiteLayoutMarkup = (pathname = '/') => {
  const normalizedPathname = pathname === '/' ? '/' : pathname.replace(/\/$/, '')
  const isStandalonePage = normalizedPathname in pages

  return `
    <div id="${SITE_SHELL_ID}" class="site-content">
      <div class="bg-dots" aria-hidden="true"></div>
      ${headerMarkup(normalizedPathname)}
      ${isStandalonePage ? pageMarkup(normalizedPathname) : landingMarkup}
      ${footerMarkup}
    </div>
  `
}

export const siteLayoutMarkup = getSiteLayoutMarkup('/')
