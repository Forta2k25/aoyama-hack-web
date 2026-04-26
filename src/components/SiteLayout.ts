import { SITE_SHELL_ID } from './SplashScreen'

export const siteLayoutMarkup = `
  <div id="${SITE_SHELL_ID}" class="site-content">
    <div class="bg-dots" aria-hidden="true"></div>

    <header class="site-header">
      <a class="brand" href="#top">青山ハック</a>
      <nav aria-label="Main navigation">
        <a href="#about">About</a>
        <a href="#app">App</a>
        <a href="#media">Media</a>
        <a href="#recruit">Recruit</a>
        <a href="#contact">Contact</a>
      </nav>
      <button class="btn btn-primary">アプリをダウンロード</button>
    </header>

    <main>
      <section id="top" class="hero reveal">
        <div class="hero-copy">
          <h1>青学の学生生活を、<br/>もっと使いやすく。</h1>
          <p>シラバス検索、時間割、学生生活をひとつに。毎日の学びを軽やかに支える学生プラットフォーム。</p>
          <div class="hero-actions">
            <button class="btn btn-primary">アプリをダウンロード</button>
            <button class="btn btn-ghost">機能を見る</button>
          </div>
        </div>
        <div class="hero-visual">
          <div class="phone-mock"></div>
          <span class="float-dot d1"></span><span class="float-dot d2"></span><span class="float-dot d3"></span>
        </div>
      </section>

      <section id="app" class="feature feature-search reveal">
        <div class="feature-copy">
          <p class="eyebrow">Feature 01</p>
          <h2>探して、すぐ見つかる。<br/>シラバス検索</h2>
          <p>必要な条件だけ選んで、今の自分に合う授業を迷わず見つける。</p>
          <div class="chips"><span>学部・学科</span><span>キャンパス</span><span>前期 / 後期</span><span>対面 / オンライン</span><span>キーワード</span></div>
        </div>
        <div class="feature-ui card">
          <div class="search-line"></div>
          <div class="course-card"></div>
          <div class="course-card"></div>
          <div class="course-card"></div>
          <aside class="mini-review">人気授業<br/>★ 4.6</aside>
        </div>
      </section>

      <section class="feature feature-share reveal">
        <div class="feature-copy">
          <p class="eyebrow mint">Feature 02</p>
          <h2>時間割を共有して、<br/>友だちとつながる。</h2>
          <p>空きコマ比較や予定合わせで、キャンパスライフをもっとスムーズに。</p>
        </div>
        <div class="share-visual">
          <div class="phone-mock tall"></div>
          <div class="phone-mock small"></div>
          <span class="link-line"></span>
        </div>
      </section>

      <section id="media" class="expand reveal">
        <div class="section-head">
          <p class="eyebrow">青山ハックのこれから</p>
          <h2>アプリだけじゃない。青学のリアルを届ける。</h2>
        </div>
        <div class="expand-grid">
          <article class="expand-card"><h3>Media</h3><p>青学の“今”を発信。</p><span>→</span></article>
          <article class="expand-card"><h3>Community</h3><p>学生同士のつながり。</p><span>→</span></article>
          <article id="recruit" class="expand-card"><h3>Recruit</h3><p>一緒につくる仲間を募集。</p><span>→</span></article>
          <article id="contact" class="expand-card"><h3>Contact</h3><p>ご意見・ご要望はこちら。</p><span>→</span></article>
        </div>
        <div class="metrics card">
          <div><strong>120,000+</strong><small>累計DL数</small></div>
          <div><strong>28,000+</strong><small>SNSフォロワー</small></div>
          <div><strong>60,000+</strong><small>利用学生数</small></div>
        </div>
        <div class="cta-row">
          <button class="btn btn-primary">コミュニティに参加する</button>
          <button class="btn btn-ghost">お問い合わせ</button>
        </div>
      </section>
    </main>

    <footer>
      <p class="brand">青山ハック</p>
      <div class="links"><a href="#">プライバシーポリシー</a><a href="#">利用規約</a><a href="#">特定商取引法に基づく表記</a></div>
      <div class="sns"><a href="#">X</a><a href="#">Instagram</a><a href="#">TikTok</a></div>
    </footer>
  </div>
`
