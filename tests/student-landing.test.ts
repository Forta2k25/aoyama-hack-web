import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { isStudentLanding, myPageDestination, studentPreviewRedirect } from '../src/student-routing.ts'
import { studentLandingMarkup, renderStudentLanding } from '../src/components/StudentLanding.ts'

test('student entry is isolated from the corporate root and existing app routes', () => {
  assert(isStudentLanding('/student', false))
  assert(isStudentLanding('/student/', false))
  assert(!isStudentLanding('/', false))
  assert(isStudentLanding('/', true))
  for (const path of ['/mypage', '/business', '/app', '/privacy-policy', '/terms', '/ai-debug', '/student-other']) {
    assert(!isStudentLanding(path, false), path)
    assert(!isStudentLanding(path, true), path)
  }
})

test('student shortcuts use real existing tabs and never invent a grade or chat route', () => {
  const doc = new JSDOM(studentLandingMarkup()).window.document
  assert.equal(doc.querySelectorAll('main').length, 1)
  assert.equal(doc.querySelectorAll('h1').length, 1)
  const links = [...doc.querySelectorAll<HTMLAnchorElement>('a')]
  assert(links.some(a => a.textContent!.includes('ログインして時間割') && a.getAttribute('href') === '/mypage#timetable'))
  assert(links.some(a => a.textContent!.includes('授業を探す') && a.getAttribute('href') === '/mypage#syllabus'))
  assert(links.some(a => a.textContent!.includes('授業AIで学ぶ') && a.getAttribute('href') === '/mypage#timetable'))
  assert(!doc.body.textContent!.includes('成績分布'))
  assert(doc.body.textContent!.includes('現在許可されたアカウント'))
  assert(links.every(a => a.getAttribute('href') !== '#'))
  assert.equal(doc.querySelectorAll('button,form,iframe').length, 0)
})

test('login keeps the selected existing tab, with no external return target', () => {
  assert.equal(myPageDestination('#syllabus'), '/mypage#syllabus')
  assert.equal(myPageDestination('#timetable'), '/mypage#timetable')
  assert.equal(myPageDestination('#friends'), '/mypage#friends')
  for (const hash of ['', '#https://example.com', '//example.com', '#chat']) assert.equal(myPageDestination(hash), '/mypage')
})

test('student local preview uses the approved Auth/upload origin and preserves the destination', () => {
  assert.equal(studentPreviewRedirect('http://127.0.0.1:5180/mypage?view=student#syllabus', true), 'http://localhost:5178/mypage?view=student#syllabus')
  assert.equal(studentPreviewRedirect('http://localhost:5180/student', true), 'http://localhost:5178/student')
  assert.equal(studentPreviewRedirect('http://[::1]:5180/', true), 'http://localhost:5178/')
  for (const url of ['http://localhost:5178/', 'http://localhost:5178/mypage#timetable', 'https://www.aoyamahack.com/', 'https://app.aoyamahack.com/', 'https://preview.vercel.app/student', 'http://localhost.example.com/']) assert.equal(studentPreviewRedirect(url, true), null, url)
  assert.equal(studentPreviewRedirect('http://127.0.0.1:5180/', false), null, 'corporate and other existing builds keep their behavior')
})

test('student renderer sets its own review metadata and mounts without Firebase or sign-in', () => {
  const dom = new JSDOM('<head><title>企業向け</title><meta name="description"><meta name="robots" content="index,follow"><meta property="og:title"><meta property="og:url"><link rel="canonical" href="https://www.aoyamahack.com/"><script type="application/ld+json">{}</script></head><body><div id="app"></div></body>', {url: 'http://localhost:5180/student'})
  Object.assign(globalThis, {document: dom.window.document, location: dom.window.location})
  renderStudentLanding()
  assert.equal(document.title, '青山ハック | 学生向けWeb')
  assert(document.querySelector('.student-portal'))
  assert(!document.querySelector('.site-header'))
  assert.equal(document.querySelector('meta[name="robots"]')!.getAttribute('content'), 'noindex,nofollow')
  assert.equal(document.querySelector('meta[property="og:url"]')!.getAttribute('content'), 'http://localhost:5180/student')
  assert(!document.querySelector('link[rel="canonical"],script[type="application/ld+json"]'))
  dom.window.close()
})
