import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleGrid, sumCredits, classifyCategory, loadTimetableSettings } from '../src/timetableSettings'

test('設定が無い端末では、6限・平日のみ', () => {
  assert.deepEqual(loadTimetableSettings(), { periods: 6, includeSaturday: false })
})

test('授業が入っているコマは、設定で隠れない', () => {
  const grid = visibleGrid({ periods: 5, includeSaturday: false }, [{ day: 5, period: 7 }])
  assert.equal(grid.days.length, 6)
  assert.equal(grid.periods.length, 7)
  const plain = visibleGrid({ periods: 5, includeSaturday: false }, [{ day: 0, period: 1 }])
  assert.deepEqual(plain, { days: [0, 1, 2, 3, 4], periods: [1, 2, 3, 4, 5] })
})

test('単位は、同じ授業を二重に数えず、アプリと同じ分類で集計する', () => {
  assert.equal(classifyCategory('青山スタンダード科目'), 'aoyama')
  assert.equal(classifyCategory('英米文学科 専門'), 'department')
  assert.equal(classifyCategory(undefined), 'free')
  const sums = sumCredits([
    { id: 'a', title: 'A', credits: 2, category: '青山スタンダード' },
    { id: 'a', title: 'A', credits: 2, category: '青山スタンダード' },
    { id: '', title: 'B', credits: 4, category: '学科科目' },
  ])
  assert.deepEqual(sums, { aoyama: 2, department: 4, free: 0 })
})

import { parseAssignments, groupAssignments } from '../src/assignments'
test('課題: アプリの形を読み、今後は日付ごと・期限切れは新しい順に分ける', () => {
  const t = (d: number) => new Date(2026, 9, d, 12, 0).getTime()
  const state = parseAssignments({
    events: [
      { uid: 'a', title: 'レポート', course: '英語', type: 'deadline', custom: false, due: t(30), url: 'https://moodle.example/x' },
      { uid: 'b', title: '小テスト', course: '', type: 'deadline', custom: true, due: t(30) },
      { uid: 'c', title: '終わった', course: '', type: 'deadline', custom: false, due: t(1) },
      { uid: 'd', title: '昔', course: '', type: 'deadline', custom: false, due: t(2), url: 'javascript:alert(1)' },
      { title: '壊れた' },
    ],
    submitted: ['a', 5],
  })
  assert.equal(state.items.length, 4)
  assert.deepEqual([...state.submitted], ['a'])
  assert.equal(state.items.find((i) => i.uid === 'd')?.url, undefined, 'http以外のリンクは捨てる')
  const g = groupAssignments(state.items, t(15))
  assert.equal(g.upcoming.length, 1)
  assert.equal(g.upcoming[0].items.length, 2)
  assert.deepEqual(g.past.map((i) => i.uid), ['d', 'c'])
})
