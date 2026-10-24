// Preview-only, read-only diagnostics. UID reveal requires an explicit action.
// Never exports tokens or timetable contents, and never persists the displayed UID.
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { timetableShape } from './timetable-shape'

export async function mountConnectionCheck(container:HTMLElement, uid:string){
  const details=document.createElement('details');details.className='ai-connection-check'
  const title=document.createElement('summary');title.textContent='本番接続を確認（読み取りのみ）'
  const output=document.createElement('pre');output.textContent='UID・時間割の保存形式を確認します。tokenや資料本文は表示しません。'
  const button=document.createElement('button');button.type='button';button.className='ai-small-button';button.textContent='接続情報を確認'
  const reveal=document.createElement('button');reveal.type='button';reveal.className='ai-small-button';reveal.textContent='本人UIDを確認'
  const uidField=document.createElement('input');uidField.readOnly=true;uidField.hidden=true;uidField.setAttribute('aria-label','Firebase UID（本人）')
  reveal.addEventListener('click',()=>{if(auth.currentUser?.uid!==uid)return;uidField.hidden=!uidField.hidden;uidField.value=uidField.hidden?'':uid;reveal.textContent=uidField.hidden?'本人UIDを確認':'UIDを隠す'})
  details.append(title,output,button,reveal,uidField);container.querySelector('.mypage-header')?.after(details)
  button.addEventListener('click',()=>void(async()=>{
    if(auth.currentUser?.uid!==uid)return
    button.disabled=true
    const project=auth.app.options.projectId,mask=`${uid.slice(0,4)}…${uid.slice(-4)}`
    const rows=[`Project: ${project}`,`Firebase UID: ${mask}`,`Provider: ${auth.currentUser.providerData.map(x=>x.providerId).join(', ')}`,'Database: (default)（時間割・授業catalog）']
    output.textContent=rows.join('\n')
    try{
      if(project!=='forta-aogaku')throw Error('PROJECT_MISMATCH')
      // Only the signed-in user's own existing timetable. No Admin SDK or other user's UID.
      const [root,terms]=await Promise.all([getDoc(doc(db,'users',uid)),getDocs(collection(db,'users',uid,'timetable'))])
      if(auth.currentUser?.uid!==uid||!details.isConnected)return
      rows.push(`users/本人: ${root.exists()?'存在':'なし'}`,`時間割documents: ${terms.size}`)
      for(const d of terms.docs){
        const label=/^assignedCourses\.\d{4}_(前期|後期)$/.test(d.id)?d.id:'（その他のdocument）'
        const shape=timetableShape(d.data())
        rows.push(`${label}: flat=${shape.flat}, cells map=${shape.nested}, fields=${shape.fields}`)
      }
      const own=root.data();rows.push(`users直下のassignedCourses: ${own&&Object.hasOwn(own,'assignedCourses')?'あり':'なし'}`)
      output.textContent=rows.join('\n')
    }catch(e){if(auth.currentUser?.uid===uid&&details.isConnected)output.textContent=rows.join('\n')+`\n読取結果: ${(e as {code?:string}).code||'確認できませんでした'}`}
    finally{button.disabled=false}
  })())
}
