import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import type { Course } from '../timetable'

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
  dayPeriod?: string   // 例: "月曜日 第3時限" (公開シラバス経由のとき)
  fromPublic?: boolean // 公開シラバス経由の結果かどうか
}

interface FilterState {
  term: string       // '', '前期', '後期', '通年', '集中'
  days: number[]     // 0=月 … 5=土
  periods: number[]  // 1–7
  campus: string     // '', '青山', '相模原'
}

const EMPTY_FILTERS: FilterState = { term: '', days: [], periods: [], campus: '' }
const DAY_LABELS = ['月', '火', '水', '木', '金', '土']
const TERM_OPTIONS = ['前期', '後期', '通年', '集中']

function hasFilters(f: FilterState): boolean {
  return !!(f.term || f.days.length || f.periods.length || f.campus)
}

function filterCount(f: FilterState): number {
  let n = 0
  if (f.term) n++
  if (f.days.length) n++
  if (f.periods.length) n++
  if (f.campus) n++
  return n
}

// ─── Markup ──────────────────────────────────────────────────────────────────

function filterPanelMarkup(): string {
  return `
    <div class="syllabus-filter-panel" id="syllabus-filter-panel" hidden>
      <div class="syllabus-filter-group">
        <span class="syllabus-filter-label">学期</span>
        <div class="syllabus-filter-chips">
          ${TERM_OPTIONS.map(t =>
            `<button class="syllabus-filter-chip" data-filter="term" data-value="${t}" type="button">${t}</button>`
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
            `<button class="syllabus-filter-chip" data-filter="period" data-value="${p}" type="button">第${p}</button>`
          ).join('')}
        </div>
      </div>
      <div class="syllabus-filter-group">
        <span class="syllabus-filter-label">キャンパス</span>
        <div class="syllabus-filter-chips">
          ${['青山', '相模原'].map(c =>
            `<button class="syllabus-filter-chip" data-filter="campus" data-value="${c}" type="button">${c}</button>`
          ).join('')}
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
        <p class="syllabus-search-hint">授業名・教員名で前方一致 ／ 絞り込みは公開シラバス経由</p>
        <button class="syllabus-filter-toggle" id="syllabus-filter-toggle" type="button" aria-expanded="false">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          絞り込み
          <span class="syllabus-filter-badge" id="syllabus-filter-badge" hidden>0</span>
        </button>
      </div>
      ${filterPanelMarkup()}
      <div id="syllabus-search-results" class="syllabus-results"></div>
    </div>
  `
}

// ─── Result card markup ───────────────────────────────────────────────────────

function resultMarkup(r: SearchResult): string {
  const chips = [
    r.registrationNumber && `<span class="syllabus-chip">登録 ${r.registrationNumber}</span>`,
    r.credit             && `<span class="syllabus-chip">${r.credit}単位</span>`,
    r.room               && `<span class="syllabus-chip">教室 ${r.room}</span>`,
    r.dayPeriod          && `<span class="syllabus-chip">${r.dayPeriod}</span>`,
    r.term               && `<span class="syllabus-chip">${r.term}</span>`,
    r.fromPublic         && `<span class="syllabus-chip syllabus-chip--public">公開</span>`,
  ].filter(Boolean).join('')

  return `
    <div class="syllabus-result-item" data-id="${r.firestoreId}" data-url="${encodeURIComponent(r.syllabusURL)}" role="button" tabindex="0">
      <div class="syllabus-result-main">
        <span class="syllabus-result-title">${r.title}</span>
        ${r.teacher ? `<span class="syllabus-result-teacher">${r.teacher}</span>` : ''}
      </div>
      ${chips ? `<div class="syllabus-result-chips">${chips}</div>` : ''}
    </div>
  `
}

// ─── Firestore search (keyword prefix) ───────────────────────────────────────

async function searchFirestore(keyword: string): Promise<SearchResult[]> {
  const end = keyword + ''

  const [snap1, snap2] = await Promise.all([
    getDocs(query(
      collection(db, 'classes'),
      where('class_name', '>=', keyword),
      where('class_name', '<=', end),
      limit(20)
    )),
    getDocs(query(
      collection(db, 'classes'),
      where('teacher_name', '>=', keyword),
      where('teacher_name', '<=', end),
      limit(10)
    )),
  ])

  const seen = new Set<string>()
  const results: SearchResult[] = []

  for (const doc of [...snap1.docs, ...snap2.docs]) {
    if (seen.has(doc.id)) continue
    seen.add(doc.id)
    const d = doc.data()
    results.push({
      firestoreId:        doc.id,
      title:              String(d['class_name']   ?? ''),
      teacher:            String(d['teacher_name'] ?? ''),
      room:               String(d['room']          ?? ''),
      credit:             d['credit'] != null ? String(d['credit']) : '',
      registrationNumber: String(d['registration_number'] ?? d['code'] ?? d['class_code'] ?? ''),
      syllabusURL:        String(d['url'] ?? d['syllabusURL'] ?? ''),
      term:               String(d['term'] ?? ''),
    })
  }

  return results
}

// ─── Public syllabus search (via proxy) ──────────────────────────────────────

const TERM_MAP: Record<string, string> = {
  '前期': '1', '後期': '2', '通年': '3', '集中': '4',
}
const DAY_PARAMS  = ['YB1', 'YB2', 'YB3', 'YB4', 'YB5', 'YB6']
const PERD_PARAMS = ['JG1', 'JG2', 'JG3', 'JG4', 'JG5', 'JG6', 'JG7']

function buildPublicSearchURL(keyword: string, filters: FilterState): string {
  const params = new URLSearchParams()
  params.set('NEN', '2026')          // 年度 (現在年度固定)
  if (keyword) params.set('KW', keyword)
  if (filters.term && TERM_MAP[filters.term]) params.set('GKB', TERM_MAP[filters.term])
  filters.days.forEach(d    => { if (DAY_PARAMS[d])    params.set(DAY_PARAMS[d], 'on') })
  filters.periods.forEach(p => { if (PERD_PARAMS[p-1]) params.set(PERD_PARAMS[p-1], 'on') })
  if (filters.campus === '青山')   params.set('CP1', 'on')
  if (filters.campus === '相模原') params.set('CP4', 'on')

  const syllabusURL = `https://syllabus.aoyama.ac.jp/Kensaku.aspx?${params.toString()}`
  return `/api/syllabus?url=${encodeURIComponent(syllabusURL)}`
}

/** 公開シラバス検索結果のHTMLをパースして SearchResult[] に変換 */
function parsePublicResults(html: string): SearchResult[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const BASE = 'https://syllabus.aoyama.ac.jp/'
  const results: SearchResult[] = []

  /** 相対URLを絶対URLに変換 */
  const toAbsolute = (href: string): string => {
    if (!href || href.startsWith('http')) return href
    if (href.startsWith('/')) return 'https://syllabus.aoyama.ac.jp' + href
    return BASE + href
  }

  /** セルテキストを取得 */
  const cellText = (el: Element): string =>
    ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(/[\s　]+/g, ' ').trim()

  /**
   * 1. シラバスリンクを含む行を全テーブルから探す
   *    → href に ".aspx" を含むか、syllabus.aoyama.ac.jp を含むリンク
   */
  const syllabusLinkRe = /\.aspx|syllabus\.aoyama\.ac\.jp/i
  const seen = new Set<string>()

  doc.querySelectorAll('table tr').forEach(row => {
    const cells = Array.from(row.querySelectorAll('td'))
    if (cells.length < 2) return

    // リンクを含むセルを探す
    let syllabusURL = ''
    let titleFromLink = ''

    for (const cell of cells) {
      const a = cell.querySelector('a[href]') as HTMLAnchorElement | null
      if (!a) continue
      const href = toAbsolute(a.getAttribute('href') ?? '')
      if (syllabusLinkRe.test(href)) {
        syllabusURL = href
        titleFromLink = cellText(a)
        break
      }
    }

    if (!syllabusURL || seen.has(syllabusURL)) return
    seen.add(syllabusURL)

    // 科目名が空 or 数字のみなら skip
    if (!titleFromLink || /^\d+$/.test(titleFromLink)) {
      // リンクが科目名でない場合は他のセルから科目名を探す
      // → 最初の非数値・非空セルを科目名とする
      for (const cell of cells) {
        const t = cellText(cell)
        if (t && !/^\d+$/.test(t) && t.length > 1) {
          titleFromLink = t
          break
        }
      }
    }
    if (!titleFromLink) return

    // 残りのセルからメタデータを推定
    const texts = cells.map(c => cellText(c))

    // 教員名: 名前っぽいセル（ひらがな・カタカナ・漢字2文字以上）
    const teacherRe = /^[぀-ゟ゠-ヿ一-鿿][぀-ゟ゠-ヿ一-鿿\s　・]{1,}/
    const teacherIdx = texts.findIndex(t => teacherRe.test(t) && t !== titleFromLink && t.length < 30)

    // 曜日・時限: "月曜日" "月3" "月曜 3時限" など
    const dayPeriodRe = /[月火水木金土]|時限|\d限/
    const dayPeriodIdx = texts.findIndex(t => dayPeriodRe.test(t) && t.length < 20)

    // 学期: 前期/後期/通年/集中
    const termRe = /前期|後期|通年|集中/
    const termIdx = texts.findIndex(t => termRe.test(t))

    // 単位: 数字 + "単位" or just "1"–"4"
    const creditRe = /^[1-4]$|単位/
    const creditIdx = texts.findIndex(t => creditRe.test(t))

    results.push({
      firestoreId:        '',  // 公開シラバスにはFirestore IDなし
      title:              titleFromLink,
      teacher:            teacherIdx >= 0 ? texts[teacherIdx] : '',
      room:               '',
      credit:             creditIdx >= 0 ? texts[creditIdx].replace('単位', '') : '',
      registrationNumber: '',
      syllabusURL,
      term:               termIdx >= 0 ? texts[termIdx] : '',
      dayPeriod:          dayPeriodIdx >= 0 ? texts[dayPeriodIdx] : '',
      fromPublic:         true,
    })
  })

  return results
}

/** 公開シラバス結果をFirestoreのURLフィールドと照合して登録番号・教室を補完 */
async function enrichWithFirestore(results: SearchResult[]): Promise<void> {
  const urlsToLookup = results
    .filter(r => r.fromPublic && r.syllabusURL)
    .map(r => r.syllabusURL)
    .slice(0, 20)  // 最大20件まで

  if (!urlsToLookup.length) return

  try {
    // `url` フィールドでまとめてIN クエリ（Firestoreはin演算子で最大30件）
    const chunks: string[][] = []
    for (let i = 0; i < urlsToLookup.length; i += 10) {
      chunks.push(urlsToLookup.slice(i, i + 10))
    }

    for (const chunk of chunks) {
      const snap = await getDocs(query(
        collection(db, 'classes'),
        where('url', 'in', chunk)
      ))
      snap.docs.forEach(docSnap => {
        const d = docSnap.data()
        const url = String(d['url'] ?? d['syllabusURL'] ?? '')
        const match = results.find(r => r.syllabusURL === url)
        if (!match) return
        match.firestoreId        = docSnap.id
        match.room               = String(d['room'] ?? '')
        match.registrationNumber = String(d['registration_number'] ?? d['code'] ?? d['class_code'] ?? '')
        match.credit             = d['credit'] != null ? String(d['credit']) : match.credit
      })
    }
  } catch {
    // enrichment失敗しても検索結果は表示する
  }
}

async function searchPublicSyllabus(keyword: string, filters: FilterState): Promise<SearchResult[]> {
  const url = buildPublicSearchURL(keyword, filters)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`)
  const html = await res.text()
  const results = parsePublicResults(html)
  await enrichWithFirestore(results)
  return results
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initSyllabusSearch(onCourseClick: (course: Course) => void): void {
  const input     = document.getElementById('syllabus-search-input') as HTMLInputElement | null
  const resultsEl = document.getElementById('syllabus-search-results')
  const clearBtn  = document.getElementById('syllabus-search-clear') as HTMLButtonElement | null
  const filterToggle   = document.getElementById('syllabus-filter-toggle') as HTMLButtonElement | null
  const filterPanel    = document.getElementById('syllabus-filter-panel')
  const filterBadge    = document.getElementById('syllabus-filter-badge')
  const filterReset    = document.getElementById('syllabus-filter-reset') as HTMLButtonElement | null
  const filterSearchBtn = document.getElementById('syllabus-filter-search-btn') as HTMLButtonElement | null

  if (!input || !resultsEl) return

  let timer: ReturnType<typeof setTimeout> | null = null
  let lastResults: SearchResult[] = []
  let filters: FilterState = { ...EMPTY_FILTERS }

  const show = (html: string) => { resultsEl.innerHTML = html }

  // ── フィルタ状態の更新 ──
  const updateFilterBadge = () => {
    const n = filterCount(filters)
    if (!filterBadge) return
    filterBadge.textContent = String(n)
    filterBadge.hidden = n === 0
  }

  // ── フィルタチップのトグル ──
  filterPanel?.querySelectorAll<HTMLButtonElement>('.syllabus-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type  = chip.dataset.filter!
      const value = chip.dataset.value!

      if (type === 'term') {
        const active = chip.classList.contains('is-active')
        // 学期は1つだけ選択可
        filterPanel.querySelectorAll('[data-filter="term"]').forEach(c => c.classList.remove('is-active'))
        filters.term = active ? '' : value
        if (!active) chip.classList.add('is-active')

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
        const active = chip.classList.contains('is-active')
        // キャンパスは1つだけ
        filterPanel.querySelectorAll('[data-filter="campus"]').forEach(c => c.classList.remove('is-active'))
        filters.campus = active ? '' : value
        if (!active) chip.classList.add('is-active')
      }

      updateFilterBadge()
    })
  })

  // ── フィルタパネル開閉 ──
  filterToggle?.addEventListener('click', () => {
    const open = !filterPanel?.hidden
    if (filterPanel) filterPanel.hidden = open
    filterToggle.setAttribute('aria-expanded', String(!open))
    filterToggle.classList.toggle('is-open', !open)
  })

  // ── リセット ──
  filterReset?.addEventListener('click', () => {
    filters = { ...EMPTY_FILTERS }
    filterPanel?.querySelectorAll('.syllabus-filter-chip').forEach(c => c.classList.remove('is-active'))
    updateFilterBadge()
    show('')
  })

  // ── 検索ロジック ──
  const doSearch = async (keyword: string, filtersSnap: FilterState) => {
    const usePublic = hasFilters(filtersSnap)
    const needKeyword = !usePublic

    if (needKeyword && keyword.length < 2) { show(''); return }

    show(`<div class="syllabus-loading">
      <span class="mypage-spinner" style="width:20px;height:20px;border-width:2px"></span>
    </div>`)

    try {
      if (usePublic) {
        lastResults = await searchPublicSyllabus(keyword, filtersSnap)
      } else {
        lastResults = await searchFirestore(keyword)
      }

      if (!lastResults.length) {
        show('<p class="syllabus-empty">授業が見つかりませんでした</p>')
        return
      }
      show(lastResults.map(resultMarkup).join(''))

      // 結果カードのクリック処理
      resultsEl.querySelectorAll<HTMLElement>('.syllabus-result-item').forEach((el, idx) => {
        const open = () => {
          const r = lastResults[idx]
          if (!r) return
          onCourseClick({
            id:             r.registrationNumber || r.firestoreId || r.syllabusURL,
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

  // ── テキスト入力（自動デバウンス、フィルタなし時のみ） ──
  input.addEventListener('input', () => {
    const val = input.value.trim()
    if (clearBtn) clearBtn.hidden = !val
    if (hasFilters(filters)) return  // フィルタあり時は手動検索のみ
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => doSearch(val, filters), 350)
  })

  // ── クリアボタン ──
  clearBtn?.addEventListener('click', () => {
    input.value = ''
    if (clearBtn) clearBtn.hidden = true
    show('')
    input.focus()
  })

  // ── 絞り込み検索ボタン ──
  filterSearchBtn?.addEventListener('click', () => {
    const keyword = input.value.trim()
    if (!hasFilters(filters) && keyword.length < 2) {
      show('<p class="syllabus-empty">検索キーワードか絞り込み条件を指定してください</p>')
      return
    }
    if (timer) clearTimeout(timer)
    doSearch(keyword, { ...filters })
  })
}
