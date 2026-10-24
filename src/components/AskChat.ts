// 時間割の「AIに質問する」バーでコマを選んだあとに開く、ChatGPTのような全画面のチャット。
// 授業回の一覧は出さず、いちばん新しい回のチャットを開く。中身(送信・保存・資料)は、既存のCourseAI/CourseChatをそのまま使う。
import type { Course } from '../timetable'
import { fetchCourseDetail } from '../timetable'
import { webAIEnabled } from '../ai/access'
import { loadCourseSyllabus } from '../ai/syllabus'
import { CourseAI } from './CourseAI'

let active: CourseAI | undefined

function loginDialog(): void {
  document.getElementById('ask-chat-login')?.remove()
  const dialog = document.createElement('dialog')
  dialog.id = 'ask-chat-login'
  dialog.className = 'ai-chat-screen ai-chat-screen--ask ask-chat-login'
  dialog.innerHTML = `
    <header class="ai-chat-screen-header"><button class="ai-small-button" type="button" aria-label="閉じる">×</button></header>
    <div class="ask-chat-login-body">
      <h2>準備ができたらどうぞ。</h2>
      <p>AIに質問するには、ログインしてください。アプリと同じGoogleアカウントで使えます。</p>
      <button class="btn btn-primary" type="button">Googleでログイン</button>
    </div>`
  document.body.append(dialog)
  const close = () => {
    const finish = () => { dialog.close(); dialog.remove() }
    if (typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) finish()
    else { dialog.classList.add('ai-chat-screen--closing'); window.setTimeout(finish, 180) }
  }
  dialog.querySelector('header button')!.addEventListener('click', close)
  dialog.querySelector('.ask-chat-login-body button')!.addEventListener('click', () => {
    void import('../auth').then(({ signInWithGoogle }) => signInWithGoogle()).then(() => location.reload())
      .catch(() => window.alert('ログインに失敗しました。もう一度お試しください。'))
  })
  dialog.showModal()
}

/** 開けたら true。AIが使えない場所(本番のドメインなど)では false を返すので、呼び出し側が授業の詳細を開く。 */
export async function openAskChat(course: Course): Promise<boolean> {
  if (!webAIEnabled()) return false
  const { getUser } = await import('../auth')
  const user = getUser()
  if (!user) { loginDialog(); return true }
  active?.dispose()
  const detail = await fetchCourseDetail(course).catch(() => undefined)
  const syllabus = loadCourseSyllabus(course.syllabusURL || detail?.syllabusURL)
  const { FirebaseAIBackend } = await import('../ai/backend')
  const resolved = {
    ...course,
    teachingTerm: detail?.term,
    syllabusURL: course.syllabusURL || detail?.syllabusURL,
    semester: course.semester ?? (detail?.term?.includes('前期') ? 'spring' : detail?.term?.includes('後期') ? 'fall' : undefined),
  } as Course
  active = new CourseAI(document.createElement('div'), resolved, user.uid, new FirebaseAIBackend(user.uid), undefined, syllabus)
  await active.mount(true)
  return true
}
