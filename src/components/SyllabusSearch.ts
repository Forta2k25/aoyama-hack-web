import type { Course } from '../timetable'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

// ─── Float bubbles: Firestore から授業をサンプリングしてアニメーション表示 ────

let _floatCache: string[] | null = null

async function fetchFloatTitles(): Promise<string[]> {
  if (_floatCache) return _floatCache
  try {
    const snap = await getDocs(query(collection(db, 'classes'), limit(80)))
    _floatCache = snap.docs
      .map(d => String(d.data()['class_name'] ?? ''))
      .filter(t => t.length >= 3 && t.length <= 22)
    return _floatCache
  } catch {
    return []
  }
}

/** Fisher-Yates で n 件抽出 */
function pickRandom<T>(arr: T[], n: number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

/** 手動調整した分散レイアウト (left%, top%) */
const BUBBLE_SLOTS = [
  [  4, 10], [ 33,  6], [ 60,  4], [ 82, 12],
  [ 14, 36], [ 44, 30], [ 70, 38],
  [  6, 62], [ 36, 58], [ 63, 65], [ 85, 56],
  [ 22, 82], [ 56, 80],
]

function buildBubbleEl(title: string, x: number, y: number): HTMLElement {
  const dur   = 4 + Math.random() * 3          // 4 〜 7 s
  const delay = -(Math.random() * dur)          // 負値でフェーズをランダムに
  const dy    = -(10 + Math.random() * 14)      // -10 〜 -24 px
  const rot   = (Math.random() - 0.5) * 1.2    // ±0.6 deg

  const el = document.createElement('button')
  el.className = 'float-bubble'
  el.textContent = title
  el.type = 'button'
  el.style.left    = `${x}%`
  el.style.top     = `${y}%`
  el.style.setProperty('--dur',   `${dur.toFixed(1)}s`)
  el.style.setProperty('--delay', `${delay.toFixed(1)}s`)
  el.style.setProperty('--dy',    `${dy.toFixed(1)}px`)
  el.style.setProperty('--rot',   `${rot.toFixed(2)}deg`)
  el.style.opacity = String(0.65 + Math.random() * 0.3)

  return el
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResult {
  firestoreId: string
  title: string
  teacher: string
  room: string
  credit: string
  registrationNumber: string
  syllabusURL: string
  term: string
  dayPeriod?: string
  evalMethod?: string  // 成績評価方法 (例: "平常点100%")
}

interface FilterState {
  term: string         // '', '前期', '後期', '通年', '集中'
  days: number[]       // 0=月 … 5=土
  periods: number[]    // 1–7
  campus: string       // '', '青山', '相模原'
  examFilter: '' | 'noExam' | 'hasExam'
  faculty: string      // '', '文学部', '理工学部', …
  department: string   // '', 'フランス文学科', … (学部選択後に表示)
}

const DEFAULT_FILTERS: FilterState = { term: '前期', days: [], periods: [], campus: '', examFilter: '', faculty: '', department: '' }
const DAY_LABELS = ['月', '火', '水', '木', '金', '土']
const TERM_OPTIONS = ['前期', '後期', '通年', '集中']

// Firestore の category 値 → 学部ラベルのマッピング（CSV の「分類」フィールド）
const FACULTY_GROUPS: Record<string, string[]> = {
  '文学部':             ['文学部共通', '文学部外国語科目', 'フランス文学科', '日本文学科', '英米文学科', '比較芸術学科', '史学科'],
  '教育人間科学部':     ['教育人間'],   // 前方一致（全角スペース区切りで続く）
  '経済学部':           ['経済学部'],
  '法学部':             ['法学部'],
  '経営学部':           ['経営学部'],
  '理工学部':           ['理工学部共通', '物理科学', '物理・数理', '化学・生命', '数理サイエンス', '情報テクノロジ', '機械創造', '電気電子工学科', '経営システム'],
  '社会情報学部':       ['社会情報学部'],
  '地球社会共生学部':   ['地球社会共生学部'],
  'コミュニティ人間科学部': ['コミュニティ人間科学部', 'ｺﾐｭﾆﾃｨ人間科学部'],
  '国際政治経済学部':   ['国際政治経済学部'],
  '総合文化政策学部':   ['総合文化政策学部'],
  '青山スタンダード':   ['青山スタンダード科目'],
}

// 学科セレクト用: 学部 → Firestore の category 値のリスト
// 学科区分のある学部のみ定義（他は学科セレクト非表示）
const DEPARTMENT_MAP: Record<string, string[]> = {
  '文学部': ['フランス文学科', '日本文学科', '英米文学科', '比較芸術学科', '史学科'],
  '教育人間科学部': ['教育人間　教育学科', '教育人間　心理学科', '教育人間　外国語科目'],
  '理工学部': ['物理科学', '物理・数理', '化学・生命', '数理サイエンス', '情報テクノロジ－', '機械創造', '電気電子工学科', '経営システム'],
}

// 学科セレクトの表示ラベル（Firestore の category 値をそのまま使うが見やすく整形）
function deptLabel(cat: string): string {
  return cat.replace(/^教育人間[　 ]/, '')  // "教育人間　教育学科" → "教育学科"
}

function filterCount(f: FilterState): number {
  let n = 0
  if (f.term)           n++
  if (f.days.length)    n++
  if (f.periods.length) n++
  if (f.campus)         n++
  if (f.examFilter)     n++
  if (f.faculty)        n++  // department は faculty の内訳なので別カウントしない
  return n
}

// ─── Actual Firestore schema (confirmed from console) ────────────────────────
//
//   term:   "（前期）"  全角括弧付き文字列
//   campus: "[青山]"    半角角括弧付き文字列
//   time:   { day: "月", periods: [1, 2, ...] }  ネストしたmap
//

const DAY_STR = ['月', '火', '水', '木', '金', '土']

/** term フィルタ用: "前期" → "（前期）" に変換して全角括弧を許容 */
function toFirestoreTerm(uiTerm: string): string {
  return `（${uiTerm}）`
}

function matchDay(d: Record<string, unknown>, days: number[]): boolean {
  if (!days.length) return true
  const time = d['time'] as Record<string, unknown> | null | undefined
  const dayVal = time?.['day'] ?? d['day']          // time.day が正規、d.day はフォールバック
  if (dayVal === undefined || dayVal === null) return true
  return days.some(idx => {
    const s = DAY_STR[idx]
    return dayVal === s ||
           dayVal === s + '曜' ||
           dayVal === s + '曜日' ||
           dayVal === idx
  })
}

function matchPeriod(d: Record<string, unknown>, periods: number[]): boolean {
  if (!periods.length) return true
  const time = d['time'] as Record<string, unknown> | null | undefined
  // time.periods は数値配列: [1], [2, 3] など
  const arr = time?.['periods'] as unknown[] | null | undefined
  if (arr) {
    return periods.some(p => arr.some(v => Number(v) === p))
  }
  // フォールバック: フラットな period フィールド
  const pVal = time?.['period'] ?? d['period'] ?? d['jigen']
  if (pVal !== undefined && pVal !== null) {
    return periods.some(p => Number(pVal) === p)
  }
  return true  // フィールド未発見 → 絞り込まない
}

function matchCampus(d: Record<string, unknown>, campus: string): boolean {
  if (!campus) return true
  // "[青山]" のように角括弧付きで格納されているので contains で確認
  const val = String(d['campus'] ?? '')
  return val.includes(campus)
}

function matchTerm(d: Record<string, unknown>, term: string): boolean {
  if (!term) return true
  const t = String(d['term'] ?? '')
  // "（前期）".includes("前期") = true
  return t.includes(term)
}

/** 試験なしフィルタ: eval_method に "試験" "テスト" "筆記" が含まれない */
function matchExam(d: Record<string, unknown>, examFilter: FilterState['examFilter']): boolean {
  if (!examFilter) return true
  const em = String(d['eval_method'] ?? '')
  if (!em) return true  // eval_method 不明 → どちらのフィルタでも除外しない
  const hasExam = /試験|テスト|筆記/.test(em)
  return examFilter === 'hasExam' ? hasExam : !hasExam
}

/** 学部・学科フィルタ: department が選択されていれば完全一致、なければ学部グループ一致 */
function matchFaculty(d: Record<string, unknown>, faculty: string, department: string): boolean {
  if (!faculty) return true
  const cat = String(d['category'] ?? '').normalize('NFKC')
  if (!cat) return true  // category 未設定は除外しない
  if (department) {
    return cat === department.normalize('NFKC') || cat.includes(department.normalize('NFKC'))
  }
  const patterns = FACULTY_GROUPS[faculty] ?? [faculty]
  return patterns.some(p => cat.includes(p.normalize('NFKC')))
}

function applyFilters(d: Record<string, unknown>, filters: FilterState): boolean {
  return matchTerm(d, filters.term) &&
         matchDay(d, filters.days) &&
         matchPeriod(d, filters.periods) &&
         matchCampus(d, filters.campus) &&
         matchExam(d, filters.examFilter) &&
         matchFaculty(d, filters.faculty, filters.department)
}

// ─── Firestore doc → SearchResult ────────────────────────────────────────────

function docToResult(id: string, d: Record<string, unknown>): SearchResult {
  // time.day / time.periods からチップ用文字列を生成
  const time = d['time'] as Record<string, unknown> | null | undefined
  const dayVal  = time?.['day'] ?? d['day']
  const perArr  = time?.['periods'] as number[] | null | undefined
  let dayPeriod = ''
  if (dayVal) {
    dayPeriod = String(dayVal) + '曜'
    if (perArr?.length) dayPeriod += ` 第${perArr[0]}限`
  } else if (perArr?.length) {
    dayPeriod = `第${perArr[0]}限`
  }
  return {
    firestoreId:        id,
    title:              String(d['class_name']   ?? ''),
    teacher:            String(d['teacher_name'] ?? ''),
    room:               String(d['room']          ?? ''),
    credit:             d['credit'] != null ? String(d['credit']) : '',
    registrationNumber: String(d['registration_number'] ?? d['code'] ?? d['class_code'] ?? ''),
    syllabusURL:        String(d['url'] ?? d['syllabusURL'] ?? ''),
    term:               String(d['term'] ?? ''),
    dayPeriod,
    evalMethod:         String(d['eval_method'] ?? '') || undefined,
  }
}

// ─── Session cache ────────────────────────────────────────────────────────────
// 学期ごとに全授業データをキャッシュ。同じ学期内の2回目以降の検索は
// Firestore 読み取りゼロ・クライアント側フィルタのみで即レスポンス。

interface CachedDoc { id: string; data: Record<string, unknown> }
const termCache = new Map<string, CachedDoc[]>()

async function loadTermDocs(term: string): Promise<CachedDoc[]> {
  const fsTerm = toFirestoreTerm(term)   // "前期" → "（前期）"
  if (termCache.has(fsTerm)) return termCache.get(fsTerm)!

  // limit なしで当該学期の全授業を取得
  let snap = await getDocs(query(collection(db, 'classes'), where('term', '==', fsTerm)))
  if (snap.empty) {
    // 括弧なしフォールバック
    snap = await getDocs(query(collection(db, 'classes'), where('term', '==', term)))
  }

  const docs: CachedDoc[] = snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }))
  termCache.set(fsTerm, docs)
  return docs
}

/** キャッシュ済みかどうかを同期で確認（ローディング表示の出し分けに使用） */
function isTermCached(term: string): boolean {
  return termCache.has(toFirestoreTerm(term))
}

/** キーワードと授業名・教員名の部分一致（前方一致ではなく contains） */
function matchKeyword(d: Record<string, unknown>, keyword: string): boolean {
  if (!keyword || keyword.length < 2) return true
  const name    = String(d['class_name']    ?? '')
  const teacher = String(d['teacher_name']  ?? '')
  return name.includes(keyword) || teacher.includes(keyword)
}

// ─── Core search ─────────────────────────────────────────────────────────────

async function searchClasses(keyword: string, filters: FilterState): Promise<SearchResult[]> {
  if (!filters.term) return []

  const docs = await loadTermDocs(filters.term)

  return docs
    .filter(({ data: d }) => matchKeyword(d, keyword) && applyFilters(d, filters))
    .map(({ id, data: d }) => docToResult(id, d))
}

// ─── Markup ──────────────────────────────────────────────────────────────────

function filterPanelMarkup(initialTerm = ''): string {
  return `
    <div class="syllabus-filter-panel" id="syllabus-filter-panel" hidden>
      <div class="syllabus-filter-group">
        <span class="syllabus-filter-label">学期</span>
        <div class="syllabus-filter-chips">
          ${TERM_OPTIONS.map(t =>
            `<button class="syllabus-filter-chip${t === initialTerm ? ' is-active' : ''}" data-filter="term" data-value="${t}" type="button">${t}</button>`
          ).join('')}
        </div>
      </div>
      <div class="syllabus-filter-group">
        <span class="syllabus-filter-label">曜日</span>
        <div class="syllabus-filter-chips">
          ${DAY_LABELS.map((d, i) =>
            `<button class="syllabus-filter-chip" data-filter="day" data-value="${i}" type="button">${d}</button>`
          ).join('')}
        </div>
      </div>
      <div class="syllabus-filter-group">
        <span class="syllabus-filter-label">時限</span>
        <div class="syllabus-filter-chips">
          ${[1, 2, 3, 4, 5, 6, 7].map(p =>
            `<button class="syllabus-filter-chip" data-filter="period" data-value="${p}" type="button">${p}限</button>`
          ).join('')}
        </div>
      </div>
      <div class="syllabus-filter-group">
        <span class="syllabus-filter-label">学部</span>
        <select class="syllabus-filter-select" id="filter-select-faculty">
          <option value="">すべて</option>
          ${Object.keys(FACULTY_GROUPS).map(f =>
            `<option value="${f}">${f}</option>`
          ).join('')}
        </select>
      </div>
      <div class="syllabus-filter-group" id="filter-group-department" hidden>
        <span class="syllabus-filter-label">学科</span>
        <select class="syllabus-filter-select" id="filter-select-department">
          <option value="">すべて</option>
        </select>
      </div>
      <div class="syllabus-filter-group">
        <span class="syllabus-filter-label">キャンパス</span>
        <div class="syllabus-filter-chips">
          ${['青山', '相模原'].map(c =>
            `<button class="syllabus-filter-chip" data-filter="campus" data-value="${c}" type="button">${c}</button>`
          ).join('')}
        </div>
      </div>
      <div class="syllabus-filter-group">
        <span class="syllabus-filter-label">試験</span>
        <div class="syllabus-filter-chips">
          <button class="syllabus-filter-chip" data-filter="exam" data-value="hasExam" type="button">あり</button>
          <button class="syllabus-filter-chip" data-filter="exam" data-value="noExam"  type="button">なし</button>
        </div>
      </div>
      <div class="syllabus-filter-actions">
        <button class="syllabus-filter-reset" id="syllabus-filter-reset" type="button">リセット</button>
        <button class="syllabus-filter-search-btn" id="syllabus-filter-search-btn" type="button">検索する</button>
      </div>
    </div>
  `
}

export function syllabusSearchMarkup(): string {
  return `
    <div class="syllabus-search">
      <div class="syllabus-search-bar-wrap">
        <svg class="syllabus-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="5" stroke="#aaa" stroke-width="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="#aaa" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input class="syllabus-search-input" id="syllabus-search-input" type="text"
               placeholder="授業名または教員名で検索..." autocomplete="off" spellcheck="false">
        <button class="syllabus-search-clear" id="syllabus-search-clear" type="button" hidden aria-label="クリア">×</button>
      </div>
      <div class="syllabus-search-meta">
        <button class="syllabus-filter-toggle" id="syllabus-filter-toggle" type="button" aria-expanded="false">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          絞り込み
          <span class="syllabus-filter-badge" id="syllabus-filter-badge" hidden>0</span>
        </button>
      </div>
      ${filterPanelMarkup(DEFAULT_FILTERS.term)}
      <div id="syllabus-float-zone" class="syllabus-float-zone" aria-hidden="true"></div>
      <div id="syllabus-search-results" class="syllabus-results"></div>
    </div>
  `
}

// ─── Result card markup ───────────────────────────────────────────────────────

/** "レポート Report" → "レポート"、"/" で分割して各行に */
function formatEvalMethod(em: string): string {
  return em
    .split('/')
    .map(part => part.trim().replace(/\s+[A-Za-z]+/g, '').trim())
    .filter(Boolean)
    .join('<br>')
}

function resultMarkup(r: SearchResult): string {
  const chips = [
    r.registrationNumber && `<span class="syllabus-chip syllabus-chip--reg">登録 ${r.registrationNumber}</span>`,
    r.credit             && `<span class="syllabus-chip syllabus-chip--credit">${r.credit}単位</span>`,
    r.room               && `<span class="syllabus-chip syllabus-chip--room">教室 ${r.room}</span>`,
    r.dayPeriod          && `<span class="syllabus-chip syllabus-chip--period">${r.dayPeriod}</span>`,
    r.term               && `<span class="syllabus-chip syllabus-chip--term">${r.term}</span>`,
  ].filter(Boolean).join('')

  return `
    <div class="syllabus-result-item" data-id="${r.firestoreId}" role="button" tabindex="0">
      <div class="syllabus-result-main">
        <div class="syllabus-result-info">
          <span class="syllabus-result-title">${r.title}</span>
          ${r.teacher ? `<span class="syllabus-result-teacher">${r.teacher}</span>` : ''}
        </div>
        ${r.evalMethod ? `<span class="syllabus-result-eval">${formatEvalMethod(r.evalMethod)}</span>` : ''}
      </div>
      ${chips ? `<div class="syllabus-result-chips">${chips}</div>` : ''}
    </div>
  `
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initSyllabusSearch(onCourseClick: (course: Course) => void): void {
  const input          = document.getElementById('syllabus-search-input') as HTMLInputElement | null
  const resultsEl      = document.getElementById('syllabus-search-results')
  const clearBtn       = document.getElementById('syllabus-search-clear') as HTMLButtonElement | null
  const filterToggle   = document.getElementById('syllabus-filter-toggle') as HTMLButtonElement | null
  const filterPanel    = document.getElementById('syllabus-filter-panel')
  const filterBadge    = document.getElementById('syllabus-filter-badge')
  const filterReset    = document.getElementById('syllabus-filter-reset') as HTMLButtonElement | null
  const filterSearchBtn = document.getElementById('syllabus-filter-search-btn') as HTMLButtonElement | null
  const floatZone      = document.getElementById('syllabus-float-zone')

  if (!input || !resultsEl) return

  let timer: ReturnType<typeof setTimeout> | null = null
  let lastResults: SearchResult[] = []
  const _url  = new URLSearchParams(location.search)
  const _ints = (s: string | null) => s ? s.split(',').map(Number).filter(n => !isNaN(n)) : []
  let filters: FilterState = {
    term:       _url.get('term')    ?? DEFAULT_FILTERS.term,
    days:       _ints(_url.get('days')),
    periods:    _ints(_url.get('periods')),
    campus:     _url.get('campus')  ?? '',
    examFilter: (_url.get('exam')   ?? '') as FilterState['examFilter'],
    faculty:    _url.get('faculty') ?? '',
    department: _url.get('dept')    ?? '',
  }
  let floatVisible = true

  // ── フロートゾーン 表示/非表示 ──
  const showFloat = (visible: boolean) => {
    if (!floatZone) return
    if (visible === floatVisible) return
    floatVisible = visible
    floatZone.classList.toggle('float-zone-hidden', !visible)
  }

  const show = (html: string) => {
    resultsEl.innerHTML = html
    showFloat(html === '')
  }

  // ── フロートバブルを生成 ──
  ;(async () => {
    if (!floatZone) return
    const titles = await fetchFloatTitles()
    if (!titles.length) return

    const slots  = pickRandom(BUBBLE_SLOTS, Math.min(BUBBLE_SLOTS.length, titles.length))
    const picked = pickRandom(titles, slots.length)

    picked.forEach((title, i) => {
      const [x, y] = slots[i]
      const el = buildBubbleEl(title, x, y)
      el.addEventListener('click', () => {
        input.value = title
        if (clearBtn) clearBtn.hidden = false
        showFloat(false)
        show(`<div class="syllabus-loading">
          <span class="mypage-spinner" style="width:20px;height:20px;border-width:2px"></span>
        </div>`)
        doSearch(title, { ...filters })
      })
      floatZone.appendChild(el)
    })
  })()

  // ── シラバスタブの表示/非表示を監視してバブルをトグル ──
  const syllabusPanel = document.getElementById('tab-panel-syllabus')
  if (syllabusPanel && floatZone) {
    new MutationObserver(() => {
      const tabVisible = !syllabusPanel.hasAttribute('hidden')
      if (!tabVisible) {
        showFloat(false)
      } else if (resultsEl.innerHTML === '') {
        showFloat(true)
      }
    }).observe(syllabusPanel, { attributes: true, attributeFilter: ['hidden'] })
  }

  // ── フィルタバッジ更新 ──
  const updateBadge = () => {
    const n = filterCount(filters)
    if (filterBadge) {
      filterBadge.textContent = String(n)
      filterBadge.hidden = n === 0
    }
  }
  updateBadge()  // デフォルト「前期」選択を初期バッジに反映

  // ── URL に検索条件を同期（replaceState で履歴を汚さない） ──
  const syncURL = () => {
    const kw = input.value.trim()
    const p  = new URLSearchParams()
    if (kw)                                    p.set('q',       kw)
    if (filters.term !== DEFAULT_FILTERS.term) p.set('term',    filters.term)
    if (filters.days.length)                   p.set('days',    filters.days.join(','))
    if (filters.periods.length)                p.set('periods', filters.periods.join(','))
    if (filters.campus)                        p.set('campus',  filters.campus)
    if (filters.examFilter)                    p.set('exam',    filters.examFilter)
    if (filters.faculty)                       p.set('faculty', filters.faculty)
    if (filters.department)                    p.set('dept',    filters.department)
    const qs = p.toString()
    history.replaceState(null, '', (qs ? `?${qs}` : location.pathname) + location.hash)
  }

  // ── フィルタチップのトグル ──
  filterPanel?.querySelectorAll<HTMLButtonElement>('.syllabus-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type  = chip.dataset.filter!
      const value = chip.dataset.value!

      if (type === 'term') {
        if (chip.classList.contains('is-active')) return  // 選択中は解除不可
        filterPanel.querySelectorAll('[data-filter="term"]').forEach(c => c.classList.remove('is-active'))
        filters.term = value
        chip.classList.add('is-active')

      } else if (type === 'day') {
        const idx = Number(value)
        if (chip.classList.toggle('is-active')) {
          filters.days = [...new Set([...filters.days, idx])]
        } else {
          filters.days = filters.days.filter(d => d !== idx)
        }

      } else if (type === 'period') {
        const p = Number(value)
        if (chip.classList.toggle('is-active')) {
          filters.periods = [...new Set([...filters.periods, p])]
        } else {
          filters.periods = filters.periods.filter(x => x !== p)
        }

      } else if (type === 'campus') {
        const wasActive = chip.classList.contains('is-active')
        filterPanel.querySelectorAll('[data-filter="campus"]').forEach(c => c.classList.remove('is-active'))
        filters.campus = wasActive ? '' : value
        if (!wasActive) chip.classList.add('is-active')

      } else if (type === 'exam') {
        const wasActive = chip.classList.contains('is-active')
        filterPanel.querySelectorAll('[data-filter="exam"]').forEach(c => c.classList.remove('is-active'))
        filters.examFilter = wasActive ? '' : value as FilterState['examFilter']
        if (!wasActive) chip.classList.add('is-active')

      }

      updateBadge()
      syncURL()
    })
  })

  // ── 学部・学科セレクト ──
  const facultySelect    = document.getElementById('filter-select-faculty')    as HTMLSelectElement | null
  const departmentGroup  = document.getElementById('filter-group-department')
  const departmentSelect = document.getElementById('filter-select-department') as HTMLSelectElement | null

  const updateDepartmentSelect = (faculty: string) => {
    if (!departmentSelect || !departmentGroup) return
    const depts = DEPARTMENT_MAP[faculty] ?? []
    departmentGroup.hidden = depts.length === 0
    departmentSelect.innerHTML = '<option value="">すべて</option>' +
      depts.map(cat => `<option value="${cat}">${deptLabel(cat)}</option>`).join('')
  }

  facultySelect?.addEventListener('change', () => {
    filters.faculty    = facultySelect.value
    filters.department = ''
    updateDepartmentSelect(facultySelect.value)
    updateBadge()
    syncURL()
  })
  departmentSelect?.addEventListener('change', () => {
    filters.department = departmentSelect.value
    updateBadge()
    syncURL()
  })

  // ── フィルタパネル開閉 ──
  filterToggle?.addEventListener('click', () => {
    const isOpen = !filterPanel?.hidden
    if (filterPanel) filterPanel.hidden = isOpen
    filterToggle.setAttribute('aria-expanded', String(!isOpen))
    filterToggle.classList.toggle('is-open', !isOpen)
  })

  // ── リセット ──
  filterReset?.addEventListener('click', () => {
    filters = { ...DEFAULT_FILTERS }
    filterPanel?.querySelectorAll('.syllabus-filter-chip').forEach(c => c.classList.remove('is-active'))
    // 学期「前期」は常に選択状態に戻す
    filterPanel?.querySelector<HTMLElement>('[data-filter="term"][data-value="前期"]')?.classList.add('is-active')
    // セレクトをリセット
    if (facultySelect)    facultySelect.value = ''
    if (departmentGroup)  departmentGroup.hidden = true
    if (departmentSelect) departmentSelect.innerHTML = '<option value="">すべて</option>'
    updateBadge()
    syncURL()
    show('')
  })

  // ── 検索実行 ──
  const doSearch = async (keyword: string, filtersSnap: FilterState) => {
    const useKeyword = keyword.length >= 2

    // デフォルト状態（前期のみ・追加フィルタなし）かつキーワードなし → バブル表示
    const isIdle = !filtersSnap.days.length && !filtersSnap.periods.length &&
                   !filtersSnap.campus && !filtersSnap.examFilter &&
                   !filtersSnap.faculty && !filtersSnap.department &&
                   filtersSnap.term === DEFAULT_FILTERS.term
    if (!useKeyword && isIdle) { show(''); return }

    showFloat(false)  // 検索開始でバブルを隠す

    // 初回（キャッシュなし）のみローディング表示。2回目以降は即レスポンスなので不要
    if (!isTermCached(filtersSnap.term)) {
      show(`<div class="syllabus-loading">
        <span class="mypage-spinner" style="width:20px;height:20px;border-width:2px"></span>
        <span style="margin-left:8px;font-size:.85rem;color:#888">授業データを読み込み中…</span>
      </div>`)
    }

    try {
      lastResults = await searchClasses(keyword, filtersSnap)

      if (!lastResults.length) {
        show('<p class="syllabus-empty">授業が見つかりませんでした</p>')
        return
      }

      show(lastResults.map(resultMarkup).join(''))

      resultsEl.querySelectorAll<HTMLElement>('.syllabus-result-item').forEach((el, idx) => {
        const open = () => {
          const r = lastResults[idx]
          if (!r) return
          onCourseClick({
            id:             r.registrationNumber || r.firestoreId,
            title:          r.title,
            room:           r.room,
            teacher:        r.teacher,
            credits:        r.credit ? Number(r.credit) : undefined,
            syllabusURL:    r.syllabusURL,
            firestoreDocID: r.firestoreId || undefined,
          })
        }
        el.addEventListener('click', open)
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open() })
      })
    } catch (err) {
      console.error('[SyllabusSearch]', err)
      show('<p class="syllabus-empty">検索中にエラーが発生しました</p>')
    }
  }

  // ── キーワード入力（フィルタの有無に関わらずデバウンス検索） ──
  input.addEventListener('input', () => {
    const val = input.value.trim()
    if (clearBtn) clearBtn.hidden = !val
    syncURL()
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => doSearch(val, filters), 350)
  })

  // ── クリア → バブルを再表示 ──
  clearBtn?.addEventListener('click', () => {
    input.value = ''
    if (clearBtn) clearBtn.hidden = true
    syncURL()
    show('')       // show('') 内で showFloat(true) が呼ばれる
    input.focus()
  })

  // ── 検索するボタン ──
  filterSearchBtn?.addEventListener('click', () => {
    if (timer) clearTimeout(timer)
    syncURL()
    doSearch(input.value.trim(), { ...filters })
  })

  // ── URL 復元: ページロード時に URL パラメータから状態を再現 ──
  ;(() => {
    const hasParams = [..._url.keys()].length > 0
    if (!hasParams) return

    const kw = _url.get('q') ?? ''
    if (kw) { input.value = kw; if (clearBtn) clearBtn.hidden = false }

    // チップの is-active 状態を URL パラメータに合わせて更新
    filterPanel?.querySelectorAll<HTMLElement>('.syllabus-filter-chip').forEach(chip => {
      const type = chip.dataset.filter!
      const val  = chip.dataset.value!
      let active = false
      if (type === 'term')   active = filters.term === val
      if (type === 'day')    active = filters.days.includes(Number(val))
      if (type === 'period') active = filters.periods.includes(Number(val))
      if (type === 'campus') active = filters.campus === val
      if (type === 'exam')   active = filters.examFilter === val
      chip.classList.toggle('is-active', active)
    })

    // 学部・学科セレクトを復元
    if (facultySelect && filters.faculty) {
      facultySelect.value = filters.faculty
      updateDepartmentSelect(filters.faculty)
      if (departmentSelect && filters.department) departmentSelect.value = filters.department
    }

    updateBadge()
    doSearch(kw, filters)
  })()
}
