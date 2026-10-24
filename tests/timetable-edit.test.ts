import test,{mock} from 'node:test'
import assert from 'node:assert/strict'
mock.module('../src/firebase.ts',{namedExports:{db:{},auth:{},storage:{},googleProvider:{}}})
const {cellHash,cellMap,upsertPayload,deletePayload,cellKey,SLOT_COLORS}=await import('../src/timetableEdit.ts')
const {slotColor}=await import('../src/timetable.ts')
const course={id:'15502',title:'Academic Writing',room:'',teacher:'架空教員',credits:2,campus:'青山',category:'学科科目',syllabusURL:'https://syllabus.example/x',firestoreDocID:'17607',localCourseUUID:'0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'}
test('コマの保存は、アプリと同じ項目名・同じハッシュ(アプリが、そのまま読める)',()=>{
  assert.equal(cellKey(1,2),'cells.d1p2')
  // アプリの slotHash: id|title|room|teacher|credits|campus|category|syllabusURL|colorKey|localCourseUUID|firestoreDocID
  assert.equal(cellHash(course,'blue'),'15502|Academic Writing||架空教員|2|青山|学科科目|https://syllabus.example/x|blue|0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d|17607')
  assert.equal(cellHash({id:'',title:'名前だけ',room:'',teacher:''}),'|名前だけ|||||||||')
  const map=cellMap(course,'blue')
  assert.deepEqual(Object.keys(map).sort(),['campus','category','colorKey','credits','firestoreDocID','h','id','localCourseUUID','room','syllabusURL','teacher','title'])
  assert.deepEqual(Object.keys(cellMap({id:'',title:'名前だけ',room:'',teacher:''})).sort(),['h','id','room','teacher','title'],'値の無い項目は、入れない')
  const stamp={stamp:true},payload=upsertPayload(1,2,course,'blue',stamp)
  assert.deepEqual(Object.keys(payload).sort(),['cells.d1p2','cells.d1p2.u','updatedAt'].sort())
  assert.equal(payload['cells.d1p2.u'],stamp);assert.equal(payload.updatedAt,stamp)
})
test('削除は、そのコマの項目と更新時刻だけを消す',()=>{
  const erase={erase:true},stamp={stamp:true},payload=deletePayload(0,5,stamp,erase)
  assert.deepEqual(payload,{'cells.d0p5':erase,'cells.d0p5.u':erase,updatedAt:stamp})
})
test('色は、アプリと同じ7色。色が無い・知らない色は、アプリと同じく、緑',()=>{
  assert.deepEqual(SLOT_COLORS.map(c=>c.key),['teal','blue','green','orange','red','gray','purple'])
  assert.equal(slotColor(undefined),slotColor('green'));assert.equal(slotColor('mint'),slotColor('green'))
  assert.notEqual(slotColor('red'),slotColor('blue'))
})
