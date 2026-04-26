import { SITE_SHELL_ID } from './SplashScreen'

export const siteLayoutMarkup = `
  <div id="${SITE_SHELL_ID}" class="site-content">
    <div class="bg-dots" aria-hidden="true"></div>

    <header class="site-header reveal">
      <div class="brand">
        <span class="brand-mark">△</span>
        <span>青山ハック</span>
      </div>
      <nav>
        <a href="#about">About</a>
        <a href="#app">App</a>
        <a href="#media">Media</a>
        <a href="#recruit">Recruit</a>
        <a href="#contact">Contact</a>
      </nav>
      <button class="btn btn-primary">📱 アプリを見る</button>
    </header>

    <main>
      <section id="about" class="panel panel-hero reveal">
        <div class="panel-copy">
          <p class="point">Point 03</p>
          <h1>探して、見つかる！<br />最強のシラバス検索</h1>
          <p>学部・学科・開講期・対面/オンラインを絞り込み。あなたにぴったりの授業をすぐ見つけられます。</p>
          <div class="chip-row">
            <span>🔎 絞り込み検索</span>
            <span>🔖 ブックマーク</span>
            <span>⭐ レビュー確認</span>
          </div>
        </div>
        <div class="mockup">
          <div class="card search-card floating"><h3>シラバス検索</h3><div class="mini-grid"><span>経営学部</span><span>対面</span><span>青山</span><span>前期</span></div><div class="search-box">授業名・教員名・キーワードを入力</div></div>
          <div class="phone-card floating delay-2"></div>
        </div>
      </section>

      <section id="app" class="panel panel-split reveal">
        <div class="panel-copy">
          <p class="point green">Point 04</p>
          <h2>友だちの時間割を<br />かんたん共有＆比較！</h2>
          <p>ワンタップ共有、比較表示、空きコマ探索まで。授業の組み合わせを視覚的にチェックできます。</p>
          <div class="chip-row"><span>👥 時間割共有</span><span>⚖️ 並べて比較</span><span>🔗 URL/QRで配布</span></div>
        </div>
        <div class="schedule-wrap">
          <div class="card list-card"><h3>友だちの時間割</h3><ul><li><b>さくら</b><span>比較中</span></li><li><b>ゆうと</b><span>比較する</span></li><li><b>りな</b><span>比較する</span></li></ul></div>
          <div class="card timetable-card floating delay-1"><h3>時間割を比較する</h3><div class="table-grid"><span></span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>1</span><span class="c1"></span><span></span><span class="c2"></span><span></span><span class="c3"></span><span>2</span><span></span><span class="c4"></span><span></span><span class="c5"></span><span></span><span>3</span><span></span><span></span><span class="c6"></span><span></span><span class="c2"></span></div></div>
        </div>
      </section>

      <section id="recruit" class="recruit reveal">
        <h2>メンバー募集中！</h2>
        <p>企画・運営・発信など、一緒に青学生活をアップデートする仲間を探しています。</p>
        <div><button class="btn btn-primary">参加する</button><button id="contact" class="btn btn-secondary">お問い合わせ</button></div>
      </section>
    </main>

    <footer><p>© 青山ハック | 青山学院大学公認の学生支援・情報発信プラットフォーム</p><a href="#top">TOP ↑</a></footer>
  </div>
`
