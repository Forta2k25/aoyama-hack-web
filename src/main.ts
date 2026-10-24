import './style.css'
import './ai/style.css'
import 'katex/dist/katex.min.css'
import { webAIEnabled } from './ai/access'
import { isStudentLanding, studentPreviewRedirect } from './student-routing'

// Normalize local review URLs before importing Firebase/auth. Landing and debug remain cloud-free.
const localRedirect = studentPreviewRedirect(location.href, __STUDENT_PORTAL_BUILD__)
if(localRedirect) {
  location.replace(localRedirect)
}else if(isStudentLanding(location.pathname, __STUDENT_PORTAL_BUILD__)) {
  // 紹介の画面は出さず、最初から時間割の画面にする(ログインしていなくても表が見える)。
  history.replaceState(null, '', '/mypage' + (location.hash || '#timetable'))
  await import('./site')
}else if(location.pathname==='/ai-project-debug' && webAIEnabled()) {
  const { renderProjectDebug }=await import('./ai/project-debug')
  await renderProjectDebug()
}else if(location.pathname==='/ai-debug' && webAIEnabled()) {
  const { renderDebug }=await import('./ai/debug')
  await renderDebug()
}else {
  await import('./site')
}
