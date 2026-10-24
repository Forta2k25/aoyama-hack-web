// A separate build can give the student site its own root without replacing the corporate site.
export function isStudentLanding(pathname: string, studentBuild: boolean): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  return path === '/student' || (studentBuild && path === '/')
}

export function myPageDestination(hash: string): string {
  return '/mypage' + (['#timetable', '#syllabus', '#friends'].includes(hash) ? hash : '')
}

// Auth authorized domains, browser storage and signed-upload CORS use the origin,
// not the machine's IP address. Reuse the approved local origin; don't expand Firebase config.
export function studentPreviewRedirect(current: string, studentBuild: boolean): string | null {
  if (!studentBuild) return null
  const url = new URL(current)
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null
  if (url.origin === 'http://localhost:5178') return null
  return 'http://localhost:5178' + url.pathname + url.search + url.hash
}
