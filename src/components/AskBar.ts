// 時間割の下の「AIに質問する」バー(アプリと同じ見た目)。文字は2秒ごとに、上から下へ入れ替わる。
const HINTS = ['リアぺ書いて', '問題解いて', '授業解説して', '小テスト作って', '授業の評価方法は？']
const SELECTING_TEXT = '聞きたい授業のコマを選んでください'
const BAR_ID = 'ask-bar'

let timer: number | undefined
let hintIndex = 0
let selecting = false
let onPick: (() => void) | undefined

function textEl(): HTMLElement | null { return document.querySelector<HTMLElement>(`#${BAR_ID} .ask-bar-text`) }

function slideTo(text: string) {
  const current = textEl()
  const viewport = current?.parentElement
  if (!current || !viewport) return
  const next = current.cloneNode() as HTMLElement
  next.textContent = text
  next.classList.add('ask-bar-text--incoming')
  viewport.appendChild(next)
  const options: KeyframeAnimationOptions = { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
  current.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(100%)', opacity: 0 }], options)
  next.animate([{ transform: 'translateY(-100%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], options)
  // アニメーションの終了を待たず、時間で片付ける(裏のタブで止まっても、文字が溜まらない)
  window.setTimeout(() => { current.remove(); next.classList.remove('ask-bar-text--incoming') }, 460)
}

function startHints() {
  window.clearInterval(timer)
  if (selecting || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timer = window.setInterval(() => {
    hintIndex = (hintIndex + 1) % HINTS.length
    slideTo(HINTS[hintIndex])
  }, 2000)
}

function setSelecting(value: boolean) {
  selecting = value
  const bar = document.getElementById(BAR_ID)
  bar?.classList.toggle('is-selecting', value)
  document.querySelector('.tt-table')?.classList.toggle('is-asking', value)
  const text = textEl()
  if (text) text.textContent = value ? SELECTING_TEXT : HINTS[hintIndex]
  bar?.setAttribute('aria-label', value ? '選ぶのをやめる' : 'AIに質問する')
  if (value) window.clearInterval(timer); else startHints()
}

/** バーを、画面の下に出す。コマを選んだら onSelect が呼ばれる。 */
export function mountAskBar(onSelect: () => void): void {
  onPick = onSelect
  if (document.getElementById(BAR_ID)) return
  document.body.insertAdjacentHTML('beforeend', `
    <div class="ask-bar" id="${BAR_ID}" role="button" tabindex="0" aria-label="AIに質問する">
      <span class="ask-bar-icon" aria-hidden="true">✦</span>
      <span class="ask-bar-viewport"><span class="ask-bar-text">${HINTS[0]}</span></span>
      <span class="ask-bar-send" aria-hidden="true">↑</span>
    </div>`)
  document.body.classList.add('has-ask-bar')
  const bar = document.getElementById(BAR_ID)!
  const toggle = () => setSelecting(!selecting)
  bar.addEventListener('click', toggle)
  bar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } })
  // コマ選びの最中に、授業のあるコマを押したら、選び終わる(押した授業の処理は、各画面が行う)
  document.addEventListener('click', (e) => {
    if (!selecting) return
    if ((e.target as HTMLElement).closest('.tt-cell-filled')) { setSelecting(false); onPick?.() }
  }, true)
  startHints()
}

export function setAskBarVisible(visible: boolean): void {
  const bar = document.getElementById(BAR_ID)
  if (bar) bar.hidden = !visible
  document.body.classList.toggle('has-ask-bar', visible && !!bar)
  if (!visible && selecting) setSelecting(false)
}
