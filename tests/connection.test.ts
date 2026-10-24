import test from 'node:test'
import assert from 'node:assert/strict'
import {timetableShape} from '../src/ai/timetable-shape.ts'
test('read-only diagnostics distinguish flat and nested cells without returning private contents',()=>{
 const cell={title:'private course',teacher:'private name'}
 assert.deepEqual(timetableShape({'cells.d0p1':cell,d1p2:cell,cells:{d2p3:cell},other:'hidden'}),{fields:4,flat:2,nested:1})
 assert.deepEqual(timetableShape({cells:null,d8p1:cell,d0p0:cell,d0p1:[]}),{fields:4,flat:0,nested:0})
 assert(!JSON.stringify(timetableShape({cells:{d0p1:cell}})).includes('private'))
})
