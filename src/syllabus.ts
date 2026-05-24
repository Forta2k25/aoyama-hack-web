export interface EvalItem {
  name: string
  percent: string
  description: string
}

export interface SyllabusContent {
  lectureItems: string[]   // 授業計画
  evalItems: EvalItem[]    // 成績評価
  outline?: string         // 講義概要
  objective?: string       // 達成目標
  condition?: string       // 履修条件
  methods: { checked: boolean; name: string }[]  // 活用される授業方法
  textbooks: { author: string; title: string }[] // 教科書
  refs: { author: string; title: string }[]      // 参考書
}

function clean(s: string) { return s.trim().replace(/[\s　\n\r]+/g, '') }
function cleanVal(s: string) { return s.trim().replace(/[ \t　]+\n/g, '\n').replace(/\n{3,}/g, '\n\n') }
function cleanLine(s: string) { return (s || '').replace(/[\s　\n\r]+/g, ' ').trim() }
function isNum(s: string) { return /^\d+$/.test(s.trim()) }

export function parseSyllabusHTML(html: string): SyllabusContent {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const lectureItems: string[] = []
  const evalItems: EvalItem[] = []

  // ── 授業計画: CPH1_gvKeikaku_* ID パターン ──
  const numEls = Array.from(doc.querySelectorAll('[id*="gvKeikaku_lblSQ_NO_"]'))
  const contentEls = Array.from(doc.querySelectorAll('[id*="gvKeikaku_lblKeikaku_"]'))
  const rowIdx = (el: Element) => parseInt(el.id.match(/\d+$/)?.[0] ?? '0', 10)
  numEls.sort((a, b) => rowIdx(a) - rowIdx(b))
  contentEls.sort((a, b) => rowIdx(a) - rowIdx(b))
  const len = Math.min(numEls.length, contentEls.length)
  for (let i = 0; i < len; i++) {
    const num = (numEls[i].textContent ?? '').trim()
    const content = cleanLine((contentEls[i] as HTMLElement).innerText ?? contentEls[i].textContent ?? '')
    if (num && content) lectureItems.push(num + '. ' + content)
  }

  // ── 成績評価: table.table-seiseki ──
  doc.querySelectorAll('table.table-seiseki tr').forEach((row) => {
    const c1 = row.querySelector('td.col1')
    const c2 = row.querySelector('td.col2')
    const c3 = row.querySelector('td.col3')
    const c4 = row.querySelector('td.col4')
    if (!c1 || !c2 || !c3) return
    if (!isNum((c1.textContent ?? '').trim())) return
    const nm   = cleanLine((c2 as HTMLElement).innerText ?? c2.textContent ?? '')
    const pct  = (c3.textContent ?? '').trim()
    const desc = c4 ? cleanLine((c4 as HTMLElement).innerText ?? c4.textContent ?? '') : ''
    if (nm && pct.includes('%')) evalItems.push({ name: nm, percent: pct, description: desc })
  })

  // ── 汎用テーブル抽出（フォールバック）──
  if (lectureItems.length === 0 || evalItems.length === 0) {
    const data: Record<string, string> = {}
    doc.querySelectorAll('table tr').forEach((row) => {
      if (row.closest('table.keikakuDetail') || row.closest('table.table-seiseki')) return
      const ths = row.querySelectorAll('th')
      const tds = row.querySelectorAll('td')
      if (ths.length > 0 && tds.length > 0) {
        const k = clean((ths[0] as HTMLElement).innerText ?? '')
        const v = cleanVal((tds[0] as HTMLElement).innerText ?? '')
        if (k && v && v !== k && k.length < 30) data[k] = v
        return
      }
      if (tds.length < 2) return
      const t = (i: number) => (tds[i] as HTMLElement | undefined)?.innerText?.trim() ?? ''
      const t0 = t(0), t1 = t(1), t2 = t(2), t3 = t(3)
      if (isNum(t0) && tds.length >= 3) {
        if (lectureItems.length === 0 && (t1.includes('授業計画') || t1.includes('Lecture') || t1.includes('Class'))) {
          if (t2) lectureItems.push(t0 + '. ' + t2.replace(/[\n\r]+/g, ' ').trim())
        } else if (t2.includes('%') && evalItems.length === 0) {
          const nm = t1.replace(/[\n\r]+/g, ' ').trim()
          if (nm) evalItems.push({ name: nm, percent: t2, description: t3 })
        } else if (t3.includes('%') && evalItems.length === 0) {
          const nm = t1.replace(/[\n\r]+/g, ' ').trim()
          if (nm) evalItems.push({ name: nm, percent: t3, description: t2 })
        }
      }
    })
  }

  // ── 青山専用: 構造化フィールド ──
  const get = (id: string) => {
    const el = doc.getElementById(id)
    return el ? ((el as HTMLElement).innerText ?? el.textContent ?? '').trim() : undefined
  }

  const outline   = get('CPH1_lblGaiyou')
  const objective = get('CPH1_lblMokuhyou')
  const condition = get('CPH1_lblJouken')

  // 活用される授業方法
  const methods: { checked: boolean; name: string }[] = []
  doc.querySelectorAll('[id*="rptHouhou_chkHouhou_"]').forEach((chk) => {
    const lbl = chk.nextElementSibling
    if (!lbl) return
    const t = ((lbl as HTMLElement).innerText ?? lbl.textContent ?? '').split('\n')[0].trim()
    if (t) methods.push({ checked: (chk as HTMLInputElement).checked, name: t })
  })

  // 教科書
  const textbooks: { author: string; title: string }[] = []
  doc.querySelectorAll('#CPH1_gvKyoukasho tr').forEach((row) => {
    const a = row.querySelector('td.books-author')
    const t = row.querySelector('td.books-title')
    if (!a || !t) return
    const tv = (t.textContent ?? '').trim()
    if (tv) textbooks.push({ author: (a.textContent ?? '').trim(), title: tv })
  })

  // 参考書
  const refs: { author: string; title: string }[] = []
  doc.querySelectorAll('#CPH1_gvSankousho tr').forEach((row) => {
    const a = row.querySelector('td.books-author')
    const t = row.querySelector('td.books-title')
    if (!a || !t) return
    const tv = (t.textContent ?? '').trim()
    if (tv) refs.push({ author: (a.textContent ?? '').trim(), title: tv })
  })

  return { lectureItems, evalItems, outline, objective, condition, methods, textbooks, refs }
}

// Netlify Function 経由でシラバスHTMLを取得しパース
export async function fetchAndParseSyllabus(syllabusURL: string): Promise<SyllabusContent | null> {
  if (!syllabusURL || !syllabusURL.includes('syllabus.aoyama.ac.jp')) return null
  try {
    const proxyURL = `/api/syllabus?url=${encodeURIComponent(syllabusURL)}`
    const res = await fetch(proxyURL)
    if (!res.ok) return null
    const html = await res.text()
    return parseSyllabusHTML(html)
  } catch {
    return null
  }
}
