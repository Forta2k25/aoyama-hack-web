import test from 'node:test'
import assert from 'node:assert/strict'
import {lectureSchedule,japanDate,meetingDay,validDate} from '../src/ai/calendar.ts'
import {makeContext,sessionKey} from '../src/ai/identity.ts'
const course={id:'#####',title:'架空授業',teacher:'架空教員',room:'',academicYear:2026,semester:'fall',meetingDay:1,campus:'青山'}
const context=makeContext(course,'synthetic-course')
test('Tuesday lecture numbers match the supplied example, excluding the September holiday',()=>{
 const result=lectureSchedule(course,context,{},'2026-10-15')
 assert.deepEqual(result.meetings.map(x=>[x.number,x.date]),[[4,'2026-10-13'],[3,'2026-10-06'],[2,'2026-09-29'],[1,'2026-09-15']]);assert(result.meetings[0].thisWeek)
 const thu=lectureSchedule({...course,meetingDay:3},context,{},'2026-10-15');assert.equal(thu.meetings[0].number,5)
})
test('official 2026 calendar has 15 real meetings for every weekday in each campus/semester, with winter recess and campus exceptions',()=>{
 for(const campus of ['青山','相模原'])for(const semester of ['spring','fall'])for(let weekday=0;weekday<6;weekday++){
  const c={...course,campus,semester,meetingDay:weekday},r=lectureSchedule(c,makeContext(c,'synthetic'),{},'2027-02-10')
  assert.equal(r.meetings.length,15,`${campus} ${semester} ${weekday}`)
  assert(!r.meetings.some(x=>x.date>='2026-12-23'&&x.date<='2027-01-07'))
 }
 const c={...course,teachingTerm:'通年'},all=lectureSchedule(c,context,{},'2027-02-10');assert.equal(all.meetings.length,30)
})
test('unknown year/weekday never invents April 1 or the current academic year; manual schedule remains explicit',()=>{
 const c={...course,academicYear:undefined,semester:undefined,meetingDay:undefined};assert.equal(lectureSchedule(c,makeContext(c,'x'),{},'2026-10-15').meetings.length,0)
 assert.equal(meetingDay({...c,timetableRecord:'assignedCourses.2026_後期:cells.d2p4'}),2)
 assert.equal(japanDate(new Date('2026-10-14T15:01:00Z')),'2026-10-15')
 assert(!validDate('2026-02-30'));assert(validDate('2026-10-13'))
 const manual=lectureSchedule(c,makeContext(c,'x'),{firstDate:'2026-09-15',skippedDates:['2026-09-22']},'2026-10-15');assert.equal(manual.meetings[0].number,4)
})
test('adjusting cancellations changes display numbering without moving saved date-keyed conversations',()=>{
 const a=lectureSchedule(course,context,{},'2026-10-15'),b=lectureSchedule(course,context,{skippedDates:['2026-09-29']},'2026-10-15')
 assert.notEqual(a.meetings[0].number,b.meetings[0].number)
 assert.equal(sessionKey({...context,dayID:a.meetings[0].dayID}),sessionKey({...context,dayID:b.meetings[0].dayID}))
})
