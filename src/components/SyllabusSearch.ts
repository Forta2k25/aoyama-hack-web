import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import type { Course } from '../timetable'

interface SearchResult {
  firestoreId: string
  title: string
  teacher: string
  room: string
  credit: string
  registrationNumber: string
  syllabusURL: string
  term: string
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
      <p class="syllabus-search-hint">前方一致で検索 ・ 教室情報は最新でない場合があります</p>
      <div id="syllabus-search-results" class="syllabus-results"></div>
    </div>
  `
}

function resultMarkup(r: SearchResult): string {
  const chips = [
    r.registrationNumber && `<span class="syllabus-chip">登録番号 ${r.registrationNumber}</span>`,
    r.credit            && `<span class="syllabus-chip">${r.credit}単位</span>`,
    r.room              && `<span class="syllabus-chip">教室 ${r.room}</span>`,
    r.term              && `<span class="syllabus-chip">${r.term}</span>`,
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

async function searchClasses(keyword: string): Promise<SearchResult[]> {
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
      firestoreId: doc.id,
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

export function initSyllabusSearch(onCourseClick: (course: Course) => void): void {
  const input    = document.getElementById('syllabus-search-input') as HTMLInputElement | null
  const resultsEl = document.getElementById('syllabus-search-results')
  const clearBtn  = document.getElementById('syllabus-search-clear') as HTMLButtonElement | null
  if (!input || !resultsEl) return

  let timer: ReturnType<typeof setTimeout> | null = null
  let lastResults: SearchResult[] = []

  const show = (html: string) => { resultsEl.innerHTML = html }

  const doSearch = async (keyword: string) => {
    if (keyword.length < 2) { show(''); return }

    show(`<div class="syllabus-loading">
      <span class="mypage-spinner" style="width:20px;height:20px;border-width:2px"></span>
    </div>`)

    try {
      lastResults = await searchClasses(keyword)
      if (!lastResults.length) {
        show('<p class="syllabus-empty">授業が見つかりませんでした</p>')
        return
      }
      show(lastResults.map(resultMarkup).join(''))

      resultsEl.querySelectorAll<HTMLElement>('.syllabus-result-item').forEach((el) => {
        const open = () => {
          const r = lastResults.find((x) => x.firestoreId === el.dataset.id)
          if (!r) return
          onCourseClick({
            id:            r.registrationNumber || r.firestoreId,
            title:         r.title,
            room:          r.room,
            teacher:       r.teacher,
            credits:       r.credit ? Number(r.credit) : undefined,
            syllabusURL:   r.syllabusURL,
            firestoreDocID: r.firestoreId,
          })
        }
        el.addEventListener('click', open)
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open() })
      })
    } catch {
      show('<p class="syllabus-empty">検索中にエラーが発生しました</p>')
    }
  }

  input.addEventListener('input', () => {
    const val = input.value.trim()
    if (clearBtn) clearBtn.hidden = !val
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => doSearch(val), 350)
  })

  clearBtn?.addEventListener('click', () => {
    input.value = ''
    if (clearBtn) clearBtn.hidden = true
    show('')
    input.focus()
  })
}
