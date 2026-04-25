import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <div class="brand">
      <div class="brand-mark">△</div>
      <span>青山ハック</span>
    </div>
    <nav>
      <a href="#about">About</a>
      <a href="#app">App</a>
      <a href="#media">Media</a>
      <a href="#recruit">Recruit</a>
      <a href="#contact">Contact</a>
    </nav>
    <button class="btn btn-primary">アプリを見る</button>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <h1>青山の学生生活を、<br />もっと使いやすく。</h1>
        <p>
          青山ハックは、履修・時間割・学事暦・学生生活情報を支える、
          学生発の非公式プラットフォームです。
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary">アプリを見る</button>
          <button class="btn btn-outline">団体について</button>
        </div>
        <small>※本サービスは青山学院大学公式のものではありません。</small>
      </div>
      <div class="hero-phones" aria-label="app previews">
        <div class="phone tilt-left"></div>
        <div class="phone"></div>
        <div class="phone tilt-right"></div>
      </div>
    </section>

    <section class="stats">
      <article><p>累計DL</p><strong>5,630+</strong></article>
      <article><p>Instagram</p><strong>4,700+</strong></article>
      <article><p>SNS総再生</p><strong>500万+</strong></article>
      <article><p>運営</p><strong>学生チーム</strong></article>
    </section>

    <section id="about" class="about">
      <div>
        <h2>青山ハックとは</h2>
        <p>
          学生目線の「困った」を、プロダクトとメディアで解決する学生プロジェクト。
          学生生活をより便利にするため、日々改善を重ねています。
        </p>
      </div>
      <div class="feature-grid">
        <article><h3>アプリ開発</h3><p>履修・時間割・学事暦・単位管理をサポート。</p></article>
        <article><h3>SNSメディア運営</h3><p>Instagram・TikTok・YouTubeで情報発信。</p></article>
        <article><h3>学生生活情報の発信</h3><p>新歓・授業・施設・イベント情報を掲載。</p></article>
      </div>
    </section>

    <section id="app" class="functions">
      <h2>アプリでできること</h2>
      <div class="function-grid">
        <article><h3>シラバス検索</h3><p>条件を絞って素早く検索。</p></article>
        <article><h3>時間割作成</h3><p>色分けして一目で管理。</p></article>
        <article><h3>学事暦</h3><p>祝日や授業日を分かりやすく表示。</p></article>
        <article><h3>単位管理</h3><p>進捗をグラフで見える化。</p></article>
      </div>
    </section>

    <section id="recruit" class="cta-grid">
      <article class="cta cta-blue">
        <h2>メンバー募集中</h2>
        <p>開発・デザイン・SNS・企画・営業など、仲間を募集しています。</p>
        <button class="btn btn-primary">参加する</button>
      </article>
      <article id="contact" class="cta cta-green">
        <h2>企業・団体の方へ</h2>
        <p>タイアップ・インターン告知・イベント協賛などご相談ください。</p>
        <button class="btn btn-success">お問い合わせ</button>
      </article>
    </section>
  </main>

  <footer>
    <div class="brand"><div class="brand-mark">△</div><span>青山ハック</span></div>
    <p>© 2026 青山ハック All Rights Reserved.</p>
  </footer>
`
