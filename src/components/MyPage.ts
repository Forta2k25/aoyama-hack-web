import {loadCourseSyllabus} from '../ai/syllabus'
import {lectureSchedule} from '../ai/calendar'
import {makeContext} from '../ai/identity'
import { webAIEnabled } from '../ai/access'
import { CourseAI } from './CourseAI'
import { type AuthUser } from '../auth'
import { fetchTimetable, fetchCourseDetail, fetchFriends, termLabel, slotColor, dayName, type TimetableSlot, type Friend } from '../timetable'
import { type SyllabusContent, type EvalItem } from '../syllabus'
import { syllabusSearchMarkup, initSyllabusSearch } from './SyllabusSearch'

const DAYS = [0, 1, 2, 3, 4] // 月〜金（土は登録があれば後から拡張）
const MAX_PERIODS = 6

// ── 友だちタブ ───────────────────────────────────────────────────────────────

async function getAvatarURL(uid: string): Promise<string | null> {
  try {
    const { getDownloadURL, ref } = await import('firebase/storage')
    const { storage } = await import('../firebase')
    return await getDownloadURL(ref(storage, `avatars/${uid}`))
  } catch {
    return null
  }
}

function friendAvatarHTML(name: string, url: string | null): string {
  if (url) return `<img class="friend-avatar" src="${url}" alt="${name}" loading="lazy">`
  const initial = (name ?? '?').charAt(0).toUpperCase()
  return `<div class="friend-avatar friend-avatar--initial">${initial}</div>`
}

function friendsListHTML(friends: Friend[], avatars: (string | null)[]): string {
  if (friends.length === 0) {
    return `<div class="mypage-empty"><p>まだ友だちがいません。</p><p>アプリから友だち申請してみましょう。</p></div>`
  }
  return friends.map((f, i) => `
    <button class="friend-card" data-uid="${f.uid}" data-name="${f.name}" type="button">
      ${friendAvatarHTML(f.name, avatars[i])}
      <div class="friend-info">
        <span class="friend-name">${f.name}</span>
        ${f.handle ? `<span class="friend-handle">@${f.handle}</span>` : ''}
      </div>
      <svg class="friend-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  `).join('')
}

function friendTTHeaderHTML(name: string): string {
  return `
    <div class="friend-tt-header">
      <button class="friend-back-btn" id="friend-back-btn" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        友だち一覧
      </button>
      <span class="friend-tt-name">${name} の時間割</span>
    </div>
  `
}

async function showFriendTimetable(panel: HTMLElement, friendUID: string, friendName: string) {
  // ローディング表示
  panel.innerHTML = `
    ${friendTTHeaderHTML(friendName)}
    <div class="mypage-loading"><div class="mypage-spinner"></div><span>読み込み中...</span></div>
  `
  bindFriendBack(panel)

  try {
    const slots = await fetchTimetable(friendUID)
    const label = termLabel()
    const hasSaturday = slots.some(s => s.day === 5)

    const ttHTML = slots.length === 0
      ? `<div class="mypage-empty"><p>${friendName}さんの時間割はまだ登録されていません。</p></div>`
      : timetableMarkup(slots, label, hasSaturday)

    panel.innerHTML = `${friendTTHeaderHTML(friendName)}${ttHTML}`
    bindFriendBack(panel)

    // コマクリックでモーダル表示（自分の時間割と同じ）
    panel.querySelectorAll<HTMLElement>('.tt-cell-filled').forEach(cell => {
      cell.addEventListener('click', () => {
        const raw = cell.getAttribute('data-course')
        if (!raw) return
        try { openCourseModal(JSON.parse(decodeURIComponent(raw)), false) } catch { /* ignore */ }
      })
    })
  } catch {
    panel.innerHTML = `
      ${friendTTHeaderHTML(friendName)}
      <div class="mypage-error"><p>時間割の取得に失敗しました。</p></div>
    `
    bindFriendBack(panel)
  }
}

function bindFriendBack(panel: HTMLElement) {
  panel.querySelector('#friend-back-btn')?.addEventListener('click', () => {
    panel.querySelector<HTMLElement>('.friend-tt-section')?.removeAttribute('hidden')
    panel.querySelector<HTMLElement>('.friend-list-section')?.removeAttribute('hidden')
    // パネルを友達リスト表示に戻す
    const listSection = panel.querySelector<HTMLElement>('.friend-list-section')
    const ttSection   = panel.querySelector<HTMLElement>('.friend-tt-section')
    if (listSection) listSection.hidden = false
    if (ttSection)   ttSection.hidden   = true
  })
}

async function loadFriendsTab(currentUID: string) {
  const panel = document.getElementById('friends-panel-inner')
  if (!panel) return

  panel.innerHTML = `<div class="mypage-loading"><div class="mypage-spinner"></div><span>読み込み中...</span></div>`

  try {
    const friends = await fetchFriends(currentUID)
    const avatars = await Promise.all(friends.map(f => getAvatarURL(f.uid)))

    panel.innerHTML = `
      <div class="friend-list-section">
        ${friendsListHTML(friends, avatars)}
      </div>
      <div class="friend-tt-section" hidden></div>
    `

    panel.querySelectorAll<HTMLButtonElement>('.friend-card').forEach(card => {
      card.addEventListener('click', () => {
        const uid  = card.dataset.uid!
        const name = card.dataset.name!
        const listSection = panel.querySelector<HTMLElement>('.friend-list-section')!
        const ttSection   = panel.querySelector<HTMLElement>('.friend-tt-section')!
        listSection.hidden = true
        ttSection.hidden   = false
        showFriendTimetable(ttSection, uid, name)
      })
    })
  } catch {
    panel.innerHTML = `<div class="mypage-error"><p>友だちの取得に失敗しました。</p></div>`
  }
}

// ── 現在時刻ライン ───────────────────────────────────────────────────────────
let _nowLineTimer: ReturnType<typeof setInterval> | null = null

function updateNowLine() {
  const scroll = document.querySelector<HTMLElement>('.tt-scroll')
  const table  = document.querySelector<HTMLElement>('.tt-table')
  if (!scroll || !table) return

  let line = scroll.querySelector<HTMLElement>('.tt-now-line')

  // 今日の曜日列を特定
  const dayHeaders = [...table.querySelectorAll<HTMLElement>('.tt-day-header')]
  const todayIdx   = dayHeaders.findIndex(h => h.classList.contains('tt-day-header--today'))
  if (todayIdx === -1) {
    // 今日が時間割に存在しない（土日など）
    if (line) line.hidden = true
    return
  }

  const now    = new Date()
  const curMin = now.getHours() * 60 + now.getMinutes()

  const ranges = (Object.entries(PERIOD_TIMES) as [string, [string, string]][])
    .map(([p, [s, e]]) => {
      const [sh, sm] = s.split(':').map(Number)
      const [eh, em] = e.split(':').map(Number)
      return { period: Number(p), start: sh * 60 + sm, end: eh * 60 + em }
    })
    .sort((a, b) => a.period - b.period)

  const firstStart = ranges[0].start
  const lastEnd    = ranges[ranges.length - 1].end

  if (curMin < firstStart || curMin > lastEnd) {
    if (line) line.hidden = true
    return
  }

  // 縦位置（topPx）
  const headerH = (table.querySelector('thead') as HTMLElement | null)?.offsetHeight ?? 37
  const cellH   = 88
  let topPx = headerH
  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i]
    if (curMin >= start && curMin <= end) {
      topPx = headerH + i * cellH + ((curMin - start) / (end - start)) * cellH
      break
    }
    if (i < ranges.length - 1 && curMin > end && curMin < ranges[i + 1].start) {
      topPx = headerH + (i + 1) * cellH
      break
    }
  }

  // 横位置（今日の列のみ）
  const cornerW = (table.querySelector<HTMLElement>('.tt-corner')?.offsetWidth) ?? 44
  const colW    = (table.offsetWidth - cornerW) / dayHeaders.length
  const colLeft = cornerW + todayIdx * colW

  if (!line) {
    line = document.createElement('div')
    line.className = 'tt-now-line'
    scroll.appendChild(line)
  }
  line.hidden      = false
  line.style.top   = `${topPx}px`
  line.style.left  = `${colLeft}px`
  line.style.width = `${colW}px`
}

function startNowLine() {
  updateNowLine()
  if (_nowLineTimer) clearInterval(_nowLineTimer)
  _nowLineTimer = setInterval(updateNowLine, 60_000)
}

function courseDetailModalMarkup() {
  return `
    <div class="course-modal-overlay" id="course-modal" aria-modal="true" role="dialog" hidden>
      <div class="course-modal-card">
        <button class="course-modal-close" id="course-modal-close" aria-label="閉じる">
          <span></span><span></span>
        </button>
        <div class="course-modal-scroll">
          <div class="course-modal-body" id="course-modal-body"></div>
        </div>
      </div>
    </div>
  `
}

// 成績評価バー
function evalBarMarkup(items: EvalItem[]): string {
  if (!items.length) return ''
  const COLORS = ['#2d8067', '#f5a623', '#4a90e2', '#9b59b6', '#e74c3c']
  const bar = items.map((it, i) => {
    const pct = parseFloat(it.percent) || 0
    return `<div style="width:${pct}%;background:${COLORS[i % COLORS.length]};height:100%;"></div>`
  }).join('')
  const legend = items.map((it, i) => {
    const jaName = it.name.replace(/\s+[A-Za-z][\w\s-]*/g, '').trim()
    return `
    <div class="eval-legend-item">
      <span class="eval-dot" style="background:${COLORS[i % COLORS.length]}"></span>
      <span class="eval-legend-name">${jaName}</span>
      <span class="eval-legend-pct" style="color:${COLORS[i % COLORS.length]}">${it.percent}</span>
      <span class="eval-legend-desc">${it.description ?? ''}</span>
    </div>`
  }).join('')
  return `
    <div class="course-section">
      <p class="course-section-label">成績評価</p>
      <div class="eval-bar">${bar}</div>
      <div class="eval-legend">${legend}</div>
    </div>`
}

// 授業計画リスト（現在週ハイライト）
function lecturePlanMarkup(items: string[], currentWeek: number): string {
  if (!items.length) return ''
  const rows = items.map((item) => {
    const match = item.match(/^(\d+)\.\s*(.+)$/)
    if (!match) return `<li class="lecture-item">${item}</li>`
    const num = parseInt(match[1], 10)
    const text = match[2]
    const isCurrent = num === currentWeek
    return `<li class="lecture-item${isCurrent ? ' lecture-item--current' : ''}">
      <span class="lecture-num">${num}</span>
      <span class="lecture-text">${text}</span>
      ${isCurrent ? '<span class="lecture-now-badge">今週</span>' : ''}
    </li>`
  }).join('')
  return `
    <div class="course-section">
      <p class="course-section-label">授業計画</p>
      <ol class="lecture-list">${rows}</ol>
    </div>`
}

// テキストセクション
function textSection(label: string, text: string | undefined): string {
  if (!text) return ''
  return `<div class="course-section">
    <p class="course-section-label">${label}</p>
    <p class="course-section-text">${text.replace(/\n/g, '<br>')}</p>
  </div>`
}

// 授業方法チップ
function methodChipsMarkup(methods: SyllabusContent['methods']): string {
  if (!methods.length) return ''
  const chips = methods.map((m) =>
    `<span class="method-chip${m.checked ? ' method-chip--active' : ''}">${m.checked ? '✓ ' : ''}${m.name}</span>`
  ).join('')
  return `<div class="course-section">
    <p class="course-section-label">活用される授業方法</p>
    <div class="method-chips">${chips}</div>
  </div>`
}

// 教科書リスト
function booksMarkup(label: string, books: SyllabusContent['textbooks']): string {
  if (!books.length) return ''
  const items = books.map((b, i) =>
    `<div class="book-item"><span class="book-num">${i + 1}</span>
      <div><span class="book-title">『${b.title}』</span>
      ${b.author ? `<small class="book-author">${b.author}</small>` : ''}</div>
    </div>`
  ).join('')
  return `<div class="course-section">
    <p class="course-section-label">${label}</p>
    ${items}
  </div>`
}


function courseDetailBodyMarkup(
  course: import('../timetable').Course,
  detail?: import('../timetable').CourseDetail,
  syllabus?: SyllabusContent | null,
  loading = false
): string {
  const chips = [
    course.teacher && `<span class="info-chip info-chip--teacher">担当教員：${course.teacher}</span>`,
    detail?.grade  && `<span class="info-chip info-chip--grade">年度：${detail.grade}</span>`,
    detail?.term   && `<span class="info-chip info-chip--term">学期：${detail.term}</span>`,
    (course.credits ?? detail?.credit) != null
      && `<span class="info-chip info-chip--credit">単位：${course.credits ?? detail?.credit}単位</span>`,
    course.room    && `<span class="info-chip info-chip--room">教室：${course.room}</span>`,
  ].filter(Boolean).join('')

  const syllabusURL = course.syllabusURL || detail?.syllabusURL || ''
  const syllabusLink = syllabusURL
    ? `<a class="course-syllabus-link" href="${syllabusURL}" target="_blank" rel="noopener noreferrer">ブラウザで全文を見る ↗</a>`
    : ''

  if (loading) {
    return `
      <h2 class="course-modal-title">${course.title}</h2>
      ${syllabusLink}
      <div class="info-chips">${chips}</div>
      <div class="course-loading-center"><span class="mypage-spinner" style="width:24px;height:24px;border-width:2px"></span></div>
    `
  }

  const week=lectureSchedule({...course,teachingTerm:detail?.term},makeContext(course,'')).meetings.find(x=>x.thisWeek)?.number??0
  return `
    <h2 class="course-modal-title">${course.title}</h2>
    ${syllabusLink}
    <div class="info-chips">${chips}</div>
    ${syllabus ? evalBarMarkup(syllabus.evalItems) : (detail?.evalMethod ? `<div class="course-section"><p class="course-section-label">成績評価方法</p><p class="course-section-text">${detail.evalMethod.replace(/\n/g, '<br>')}</p></div>` : '')}
    ${syllabus ? lecturePlanMarkup(syllabus.lectureItems, week) : ''}
    ${syllabus ? textSection('講義概要', syllabus.outline) : ''}
    ${syllabus ? textSection('達成目標', syllabus.objective) : ''}
    ${syllabus ? methodChipsMarkup(syllabus.methods) : ''}
    ${syllabus ? booksMarkup('教科書', syllabus.textbooks) : ''}
    ${syllabus ? booksMarkup('参考書', syllabus.refs) : ''}
  `
}

let _outsideClickHandler: ((e: MouseEvent) => void) | null = null

let _courseRequest=0
let _activeAI: CourseAI | undefined
let _outsideTimer: ReturnType<typeof setTimeout> | undefined

export function openCourseModal(course: import('../timetable').Course, allowAI=true) {
  closeCourseModal()
  const ticket=++_courseRequest
  const timetableActive=!document.getElementById('tab-panel-timetable')?.hasAttribute('hidden')
  const desktop=window.innerWidth>=800 && timetableActive
  const panel=document.getElementById(desktop?'course-side-panel':'course-modal')
  const body=document.getElementById(desktop?'course-side-body':'course-modal-body')
  if(!panel||!body)return
  let detail: import('../timetable').CourseDetail | undefined, syllabus: SyllabusContent | null | undefined
  let activeTab: 'syllabus' | 'ai'='syllabus', aiHost: HTMLElement | undefined, mounted=false
  const available=allowAI&&webAIEnabled()
  const detailPromise=fetchCourseDetail(course)
  // The display and every lecture chat share this course-bound request, including early AI-tab clicks.
  const syllabusPromise=detailPromise.then(value=>{
    if(ticket!==_courseRequest)return {status:'absent' as const}
    detail=value;return loadCourseSyllabus(course.syllabusURL||value.syllabusURL)
  },()=>ticket===_courseRequest?loadCourseSyllabus(course.syllabusURL):{status:'absent' as const})
  const shell=document.createElement('div'),syllabusHost=document.createElement('div')
  const tabs=document.createElement('div');tabs.className='course-detail-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','授業の詳細')
  const buttons:HTMLButtonElement[]=[]
  function selectTab(tab:'syllabus'|'ai'){
    activeTab=tab;syllabusHost.hidden=tab!=='syllabus';if(aiHost)aiHost.hidden=tab!=='ai'
    buttons.forEach((button,index)=>{const selected=(index===0)===(tab==='syllabus');button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1})
    panel!.classList.toggle('course-panel--ai',tab==='ai')
    if(tab==='ai'&&aiHost&&!mounted){
      mounted=true;aiHost.textContent='AIハックを準備しています…'
      void (async()=>{
        const resolvedDetail=await detailPromise.catch(()=>undefined)
        const {getUser}=await import('../auth'),user=getUser()
        if(ticket!==_courseRequest||!aiHost)return
        if(!user){aiHost.textContent='AIハックを使うには、マイページからログインしてください。';return}
        const {FirebaseAIBackend}=await import('../ai/backend')
        if(ticket!==_courseRequest)return
        const resolved={...course,teachingTerm:resolvedDetail?.term,syllabusURL:course.syllabusURL||resolvedDetail?.syllabusURL,semester:course.semester ?? (resolvedDetail?.term?.includes('前期')?'spring':resolvedDetail?.term?.includes('後期')?'fall':undefined)}
        _activeAI=new CourseAI(aiHost,resolved,user.uid,new FirebaseAIBackend(user.uid),undefined,syllabusPromise);await _activeAI.mount()
      })().catch(()=>{if(ticket===_courseRequest&&aiHost)aiHost.textContent='AIハックの準備に失敗しました。授業を開き直してください。'})
    }
  }
  for(const [tab,title]of [['syllabus','シラバス'],['ai','AIチャット ✦']] as const){
    if(tab==='ai'&&!available)continue
    const button=document.createElement('button');button.type='button';button.textContent=title;button.setAttribute('role','tab');button.id=`course-${ticket}-tab-${tab}`;button.setAttribute('aria-controls',`course-${ticket}-panel-${tab}`)
    button.addEventListener('click',()=>selectTab(tab));button.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const next=activeTab==='syllabus'?'ai':'syllabus';if(available){selectTab(next);buttons[next==='ai'?1:0].focus()}}});buttons.push(button);tabs.append(button)
  }
  syllabusHost.id=`course-${ticket}-panel-syllabus`;if(available){syllabusHost.setAttribute('role','tabpanel');syllabusHost.setAttribute('aria-labelledby',`course-${ticket}-tab-syllabus`)}
  if(available){aiHost=document.createElement('div');aiHost.id=`course-${ticket}-panel-ai`;aiHost.setAttribute('role','tabpanel');aiHost.setAttribute('aria-labelledby',`course-${ticket}-tab-ai`);aiHost.hidden=true}
  if(available)shell.append(tabs);shell.append(syllabusHost);if(aiHost)shell.append(aiHost);body.replaceChildren(shell)
  const updateSyllabus=(loading:boolean)=>{syllabusHost.innerHTML=courseDetailBodyMarkup(course,detail,syllabus,loading)}
  updateSyllabus(true);selectTab('syllabus')
  if(desktop){
    panel.classList.add('is-open')
    const layout=document.getElementById('mypage-layout');if(layout)window.scrollTo({top:Math.max(0,layout.getBoundingClientRect().top+window.scrollY-96),behavior:'smooth'})
    // Keep the panel open while using the timetable, its scroll bars, a picker or an AI dialog.
    _outsideClickHandler=(event:MouseEvent)=>{const inside=event.composedPath().some(node=>node instanceof HTMLElement&&node.matches('#course-side-panel,.tt-cell-filled,dialog'));if(!inside)closeCourseModal()}
    _outsideTimer=setTimeout(()=>{if(ticket===_courseRequest&&_outsideClickHandler)document.addEventListener('click',_outsideClickHandler)},100)
  }else{
    panel.hidden=false;document.body.classList.add('modal-open');panel.querySelector<HTMLElement>('.course-modal-close')?.focus({preventScroll:true})
  }
  void syllabusPromise.then(reference=>{
    if(ticket!==_courseRequest)return
    syllabus=reference.content??null;updateSyllabus(false)
  })
}

export function closeCourseModal() {
  _courseRequest++;_activeAI?.dispose();_activeAI=undefined;clearTimeout(_outsideTimer)
  const modal=document.getElementById('course-modal');if(modal){modal.hidden=true;modal.classList.remove('course-panel--ai');document.body.classList.remove('modal-open')}
  const side=document.getElementById('course-side-panel');side?.classList.remove('is-open','course-panel--ai')
  document.getElementById('course-side-body')?.replaceChildren()
  document.getElementById('course-modal-body')?.replaceChildren()
  if(_outsideClickHandler){document.removeEventListener('click',_outsideClickHandler);_outsideClickHandler=null}
}

function loginMarkup() {
  return `
    <div class="mypage-login">
      <div class="mypage-login-inner">
        <p class="eyebrow">マイページ</p>
        <h1>時間割をウェブでも確認</h1>
        <p>アプリでGoogleアカウントを連携すると、登録した時間割をウェブでも確認できます。</p>
        <div class="mypage-login-steps">
          <p class="mypage-login-steps-label">Web版を使うには</p>
          <ol>
            <li>アプリの <strong>友だち</strong> タブを開く</li>
            <li><strong>自分のプロフィール</strong> をタップ</li>
            <li><strong>Google連携</strong> からアカウントを連携</li>
          </ol>
        </div>
        <button class="btn btn-primary mypage-google-signin" id="mypage-signin-btn" type="button">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Googleでログイン
        </button>
        <p class="mypage-login-note">連携したGoogleアカウントと同じものでログインしてください。</p>
      </div>
    </div>
  `
}

function loadingMarkup() {
  return `
    <div class="mypage-loading">
      <span class="mypage-spinner"></span>
      <p>時間割を読み込み中...</p>
    </div>
  `
}

function emptyMarkup(label: string) {
  return `
    <div class="mypage-empty">
      <p>${label}の時間割はまだ登録されていません。</p>
      <p>アプリから授業を登録してください。</p>
    </div>
  `
}

const PERIOD_TIMES: Record<number, [string, string]> = {
  1: ['9:00',  '10:30'],
  2: ['11:00', '12:30'],
  3: ['13:20', '14:50'],
  4: ['15:05', '16:35'],
  5: ['16:50', '18:20'],
  6: ['18:30', '20:00'],
  7: ['20:10', '21:40'],
}

function timetableMarkup(slots: TimetableSlot[], label: string, hasSaturday: boolean): string {
  const days = hasSaturday ? [0, 1, 2, 3, 4, 5] : DAYS
  const periods = Array.from({ length: MAX_PERIODS }, (_, i) => i + 1)

  // slots を day/period でインデックス
  const grid: Record<string, TimetableSlot> = {}
  slots.forEach((s) => { grid[`${s.day}-${s.period}`] = s })

  const todayDay = (new Date().getDay() + 6) % 7  // 0=月,1=火,...,5=土
  const dayHeaders = days.map((d) => `<th class="tt-day-header${d === todayDay ? ' tt-day-header--today' : ''}">${dayName(d)}</th>`).join('')

  const rows = periods.map((p) => {
    const cells = days.map((d) => {
      const slot = grid[`${d}-${p}`]
      if (!slot) {
        return `<td class="tt-cell tt-cell-empty"><div class="tt-cell-inner"></div></td>`
      }
      const bg = slotColor(slot.course.colorKey)
      const roomText = slot.course.room ? `<small class="tt-room">${slot.course.room}</small>` : ''
      const courseJson = encodeURIComponent(JSON.stringify(slot.course))
      return `
        <td class="tt-cell tt-cell-filled" style="background:${bg}" data-course="${courseJson}" tabindex="0" role="button" aria-label="${slot.course.title}">
          <div class="tt-cell-inner">
            <span class="tt-title">${slot.course.title}</span>
            ${roomText}
          </div>
        </td>
      `
    }).join('')
    const [start, end] = PERIOD_TIMES[p] ?? ['', '']
    return `<tr><th class="tt-period-header">
      <span class="tt-period-time">${start}</span>
      <span class="tt-period-num">${p}</span>
      <span class="tt-period-time">${end}</span>
    </th>${cells}</tr>`
  }).join('')

  return `
    <div class="mypage-layout" id="mypage-layout">
      <aside class="course-side-panel" id="course-side-panel">
        <div class="course-side-inner">
          <button class="course-side-close" id="course-side-close" aria-label="閉じる">
            <span></span><span></span>
          </button>
          <div class="course-side-scroll">
            <div class="course-side-body" id="course-side-body"></div>
          </div>
        </div>
      </aside>
      <div class="tt-main">
        <div class="tt-wrapper">
          <div class="tt-label-row">
            <span class="eyebrow">${label}</span>
          </div>
          <div class="tt-scroll">
            <table class="tt-table">
              <thead><tr><th class="tt-corner"></th>${dayHeaders}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
}

export function mypageMarkup() {
  return `
    <main class="page-main mypage">
      <section class="content-page reveal">
        <div id="mypage-content">
          ${loginMarkup()}
        </div>
      </section>
    </main>
  `
}

let _pageRequest=0
export async function renderMyPage(user: AuthUser) {
  const pageRequest=++_pageRequest
  closeCourseModal()
  const container = document.getElementById('mypage-content')
  if (!container) return

  if (!user) {
    container.innerHTML = loginMarkup()
    return
  }

  container.innerHTML = loadingMarkup()

  try {
    const slots = await fetchTimetable(user.uid)
    if(pageRequest!==_pageRequest)return
    const label = termLabel()
    const tabsBar = `
      <div class="mypage-tabs-bar">
        <button class="mypage-tab mypage-tab--active" id="tab-timetable" type="button">時間割</button>
        <button class="mypage-tab" id="tab-syllabus" type="button">シラバス</button>
        <button class="mypage-tab" id="tab-friends" type="button">友だち</button>
      </div>
    `
    const friendsPanel = `
      <div id="tab-panel-friends" hidden>
        <div id="friends-panel-inner" class="friends-panel">
          <div class="mypage-loading"><div class="mypage-spinner"></div><span>読み込み中...</span></div>
        </div>
      </div>
    `
    // モーダルは .reveal の transform 影響外に置くため document.body 直下に挿入
    if (!document.getElementById('course-modal')) {
      document.body.insertAdjacentHTML('beforeend', courseDetailModalMarkup())
    }

    if (slots.length === 0) {
      container.innerHTML = `
        <div class="mypage-header">
          <p class="eyebrow">マイページ</p>
          <button class="btn btn-ghost mypage-signout" id="mypage-signout-btn" type="button">ログアウト</button>
        </div>
        ${tabsBar}
        <div id="tab-panel-timetable">${emptyMarkup(label)}</div>
        <div id="tab-panel-syllabus" hidden>${syllabusSearchMarkup()}</div>
        ${friendsPanel}
      `
    } else {
      const hasSaturday = slots.some((s) => s.day === 5)
      container.innerHTML = `
        <div class="mypage-header">
          <p class="eyebrow">マイページ</p>
          <button class="btn btn-ghost mypage-signout" id="mypage-signout-btn" type="button">ログアウト</button>
        </div>
        ${tabsBar}
        <div id="tab-panel-timetable">${timetableMarkup(slots, label, hasSaturday)}</div>
        <div id="tab-panel-syllabus" hidden>${syllabusSearchMarkup()}</div>
        ${friendsPanel}
      `
      // コマのクリックイベント
      container.querySelectorAll<HTMLElement>('.tt-cell-filled').forEach((cell) => {
        const handler = () => {
          const raw = cell.getAttribute('data-course')
          if (!raw) return
          try {
            openCourseModal(JSON.parse(decodeURIComponent(raw)))
          } catch { /* ignore */ }
        }
        cell.addEventListener('click', handler)
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handler() })
      })
      // パネル・モーダルを閉じる
      document.getElementById('course-side-close')?.addEventListener('click', closeCourseModal)
      document.getElementById('course-modal-close')?.addEventListener('click', closeCourseModal)
      document.getElementById('course-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeCourseModal()
      })
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape'&&!document.querySelector('dialog[open]')) closeCourseModal() })
    }
    if(webAIEnabled())void import('../ai/connection').then(({mountConnectionCheck})=>{if(pageRequest===_pageRequest)void mountConnectionCheck(container,user.uid)})
    // 現在時刻ライン（時間割タブのみ）
    startNowLine()

    // タブ切り替え
    let _friendsLoaded = false
    type Tab = 'timetable' | 'syllabus' | 'friends'
    const showTab = (tab: Tab, pushHistory = true) => {
      (['timetable', 'syllabus', 'friends'] as Tab[]).forEach(t => {
        document.getElementById(`tab-panel-${t}`)?.toggleAttribute('hidden', t !== tab)
        document.getElementById(`tab-${t}`)?.classList.toggle('mypage-tab--active', t === tab)
      })
      if (tab !== 'timetable') closeCourseModal()
      if (pushHistory) history.pushState(null, '', location.search + `#${tab}`)
      // 友だちタブは初回表示時にロード
      if (tab === 'friends' && !_friendsLoaded) {
        _friendsLoaded = true
        loadFriendsTab(user.uid)
      }
    }
    document.getElementById('tab-timetable')?.addEventListener('click', () => showTab('timetable'))
    document.getElementById('tab-syllabus')?.addEventListener('click',   () => showTab('syllabus'))
    document.getElementById('tab-friends')?.addEventListener('click',    () => showTab('friends'))
    window.addEventListener('popstate', () => {
      const h = location.hash
      showTab(h === '#syllabus' ? 'syllabus' : h === '#friends' ? 'friends' : 'timetable', false)
    })
    // 初期ロード: URL の hash でタブを決定
    const initHash = location.hash
    if (initHash === '#syllabus') showTab('syllabus', false)
    else if (initHash === '#friends') showTab('friends', false)

    initSyllabusSearch(openCourseModal)
  } catch {
    container.innerHTML = `
      <div class="mypage-error">
        <p>時間割の取得に失敗しました。</p>
        <button class="btn btn-ghost" onclick="window.location.reload()">再試行</button>
      </div>
    `
  }
}
