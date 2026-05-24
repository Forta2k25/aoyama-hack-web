import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import type { Course } from '../timetable'

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
  if (f.term)          n++
  if (f.days.length)   n++
  if (f.periods.length) n++
  if (f.campus)        n++
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

function applyFilters(d: Record<string, unknown>, filters: FilterState): boolean {
  return matchTerm(d, filters.term) &&
         matchDay(d, filters.days) &&
         matchPeriod(d, filters.periods) &&
         matchCampus(d, filters.campus)
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
  }
}

// ─── Core search ─────────────────────────────────────────────────────────────

async function searchClasses(keyword: string, filters: FilterState): Promise<SearchResult[]> {
  const useKeyword = keyword.length >= 2
  const useTerm    = !!filters.term
  const useOther   = !!(filters.days.length || filters.periods.length || filters.campus)

  // keyword も term も未入力で day/period/campus だけ → 広すぎるためガイドを返す
  if (!useKeyword && !useTerm && useOther) return []

  // ─ keyword あり: class_name / teacher_name 前方一致 ─
  if (useKeyword) {
    const end  = keyword + ''
    const lim  = hasFilters(filters) ? 200 : 20
    const lim2 = hasFilters(filters) ? 100 : 10

    const [snap1, snap2] = await Promise.all([
      getDocs(query(
        collection(db, 'classes'),
        where('class_name', '>=', keyword),
        where('class_name', '<=', end),
        limit(lim)
      )),
      getDocs(query(
        collection(db, 'classes'),
        where('teacher_name', '>=', keyword),
        where('teacher_name', '<=', end),
        limit(lim2)
      )),
    ])

    const seen = new Set<string>()
    const docs: SearchResult[] = []
    for (const doc of [...snap1.docs, ...snap2.docs]) {
      if (seen.has(doc.id)) continue
      seen.add(doc.id)
      const d = doc.data() as Record<string, unknown>
      if (applyFilters(d, filters)) docs.push(docToResult(doc.id, d))
    }
    return docs
  }

  // ─ term のみ: term 前方一致クエリ → クライアント絞り込み ─
  if (useTerm) {
    const termEnd = filters.term + ''

    // Firestoreの term は "（前期）" 形式なのでまず括弧付きで試みる
    const fsTerm = toFirestoreTerm(filters.term)  // "前期" → "（前期）"
    let snap = await getDocs(query(
      collection(db, 'classes'),
      where('term', '==', fsTerm),
      limit(500)
    ))

    // 0件なら括弧なしの完全一致を試みる
    if (snap.empty) {
      snap = await getDocs(query(
        collection(db, 'classes'),
        where('term', '==', filters.term),
        limit(500)
      ))
    }

    // まだ0件なら term の contains は Firestore 不可なので前方一致で近似
    if (snap.empty) {
      snap = await getDocs(query(
        collection(db, 'classes'),
        where('term', '>=', filters.term),
        where('term', '<=', termEnd),
        limit(500)
      ))
    }

    return snap.docs
      .filter(doc => {
        const d = doc.data() as Record<string, unknown>
        // term は既にクエリで絞れているので day/period/campus だけ適用
        return matchDay(d, filters.days) &&
               matchPeriod(d, filters.periods) &&
               matchCampus(d, filters.campus)
      })
      .map(doc => docToResult(doc.id, doc.data() as Record<string, unknown>))
  }

  return []
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
        <p class="syllabus-search-hint">学期か授業名で絞り込み（Firestore直接検索）</p>
        <button class="syllabus-filter-toggle" id="syllabus-filter-toggle" type="button" aria-expanded="false">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          絞り込み
          <span class="syllabus-filter-badge" id="syllabus-filter-badge" hidden>0</span>
        </button>
      </div>
      ${filterPanelMarkup()}
      <div id="syllabus-float-zone" class="syllabus-float-zone" aria-hidden="true"></div>
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
  ].filter(Boolean).join('')

  return `
    <div class="syllabus-result-item" data-id="${r.firestoreId}" role="button" tabindex="0">
      <div class="syllabus-result-main">
        <span class="syllabus-result-title">${r.title}</span>
        ${r.teacher ? `<span class="syllabus-result-teacher">${r.teacher}</span>` : ''}
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
  let filters: FilterState = { ...EMPTY_FILTERS }
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

  // ── フィルタバッジ更新 ──
  const updateBadge = () => {
    const n = filterCount(filters)
    if (filterBadge) {
      filterBadge.textContent = String(n)
      filterBadge.hidden = n === 0
    }
  }

  // ── フィルタチップのトグル ──
  filterPanel?.querySelectorAll<HTMLButtonElement>('.syllabus-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type  = chip.dataset.filter!
      const value = chip.dataset.value!

      if (type === 'term') {
        const wasActive = chip.classList.contains('is-active')
        filterPanel.querySelectorAll('[data-filter="term"]').forEach(c => c.classList.remove('is-active'))
        filters.term = wasActive ? '' : value
        if (!wasActive) chip.classList.add('is-active')

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
      }

      updateBadge()
    })
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
    filters = { ...EMPTY_FILTERS }
    filterPanel?.querySelectorAll('.syllabus-filter-chip').forEach(c => c.classList.remove('is-active'))
    updateBadge()
    show('')
  })

  // ── 検索実行 ──
  const doSearch = async (keyword: string, filtersSnap: FilterState) => {
    const useKeyword = keyword.length >= 2
    const useTerm    = !!filtersSnap.term
    const useOther   = !!(filtersSnap.days.length || filtersSnap.periods.length || filtersSnap.campus)

    // 何も指定されていない → バブルを見せる
    if (!useKeyword && !hasFilters(filtersSnap)) { show(''); return }

    showFloat(false)  // 検索開始でバブルを隠す

    // day/period/campus だけで keyword も term もない場合
    if (!useKeyword && !useTerm && useOther) {
      show('<p class="syllabus-empty">学期かキーワードを指定してください</p>')
      return
    }

    show(`<div class="syllabus-loading">
      <span class="mypage-spinner" style="width:20px;height:20px;border-width:2px"></span>
    </div>`)

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

  // ── キーワード入力（フィルタなし時は自動デバウンス） ──
  input.addEventListener('input', () => {
    const val = input.value.trim()
    if (clearBtn) clearBtn.hidden = !val
    if (hasFilters(filters)) return  // フィルタあり → 手動検索のみ
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => doSearch(val, filters), 350)
  })

  // ── クリア → バブルを再表示 ──
  clearBtn?.addEventListener('click', () => {
    input.value = ''
    if (clearBtn) clearBtn.hidden = true
    show('')       // show('') 内で showFloat(true) が呼ばれる
    input.focus()
  })

  // ── 検索するボタン ──
  filterSearchBtn?.addEventListener('click', () => {
    if (timer) clearTimeout(timer)
    doSearch(input.value.trim(), { ...filters })
  })
}
