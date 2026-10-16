import type { Course } from '../timetable'
import { imageFileAccept, isHEIC } from '../ai/image'
import { copyAnswer, shareAnswer } from '../ai/answer-actions'
import { materialProgress } from '../ai/material-progress'
import { AIController } from '../ai/controller'
import { AIStore } from '../ai/store'
import { resolveContext, offeringId, courseKey } from '../ai/identity'
import { evidenceText, metadataText, safeError } from '../ai/format'
import type { AIBackend, CourseContext, Evidence, LocalMaterial, Message } from '../ai/types'

function el<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text?:string){const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node}
function button(label:string,action:()=>void,className='ai-small-button'){const b=el('button',className,label);b.type='button';b.addEventListener('click',action);return b}
function abortableError(error:unknown){return error instanceof Error&&error.name==='AbortError'}
export class CourseChat {
  private controller?:AIController;private disposed=false;private record?:MediaRecorder;private audio?:MediaStream;private recordTimer?:ReturnType<typeof setTimeout>
  private thread=el('div','ai-thread');private materials=el('div','ai-materials');private notice=el('p','ai-notice');private status=el('p','ai-status');private textarea=el('textarea','ai-composer-input')
  private send=el('button','ai-send','送信 ↑');private stop=el('button','ai-small-button','生成を中断');private composer=el('form','ai-composer');private recordButton=el('button','ai-menu-item','録音を開始')
  private selectedEvidence?:string;private evidenceSignature='';private evidence=el('details','ai-evidence');private evidenceBody=el('div','ai-evidence-body');private evidenceTicket=0
  private materialsPanel=el('dialog','ai-materials-dialog');private materialsButton=button('資料 (0)',()=>this.openMaterials(),'ai-materials-toggle');private materialsEmpty=el('p','ai-materials-empty','この授業回には、まだ資料がありません。');private toolbar?:HTMLElement
  private bubbles=new Map<string,HTMLElement>();private initError='';private hasAutoScrolled=false
  private attachments=el('div','ai-composer-attachments');private attachmentCards=new Map<string,HTMLElement>()
  private sendWait=el('p','ai-send-wait')
  private thumbnails=new Map<string,{file:Blob;url:string}>();private recentAttachments=new Set<string>();private dismissedAttachments=new Set<string>()
  private root:HTMLElement;private course:Course;private uid:string;private backend:AIBackend;private store:AIStore;private context?:CourseContext
  constructor(root:HTMLElement,course:Course,uid:string,backend:AIBackend,store=new AIStore(),context?:CourseContext,toolbar?:HTMLElement){this.toolbar=toolbar;this.context=context;this.root=root;this.course=course;this.uid=uid;this.backend=backend;this.store=store}
  async mount(){
    this.root.replaceChildren();this.root.classList.add('web-ai')
    this.notice.textContent=this.backend.demo?'デバッグ専用・架空の応答です。Firebase／外部AIへは送信しません。':'本番接続 · forta-aogaku · 自分の資料のみ。利用には既存pilotの許可が必要です。'
    this.root.append(this.notice)
    const identity=el('p','ai-course-identity');identity.textContent='授業を確認しています…';this.root.append(identity)
    const header=el('header','ai-materials-panel-header'),title=el('h3','','この授業回の資料'),close=button('閉じる',()=>this.materialsPanel.close())
    title.id=`ai-materials-title-${crypto.randomUUID()}`;header.append(title,close)
    this.materialsPanel.id=`ai-materials-${crypto.randomUUID()}`;this.materialsPanel.setAttribute('aria-labelledby',title.id)
    this.materialsButton.setAttribute('aria-controls',this.materialsPanel.id);this.materialsButton.setAttribute('aria-haspopup','dialog');this.materialsButton.setAttribute('aria-expanded','false')
    this.materialsPanel.addEventListener('close',()=>{this.materialsButton.setAttribute('aria-expanded','false');if(!this.disposed)this.materialsButton.focus()})
    const content=el('div','ai-materials-panel-content');content.append(el('p','ai-materials-help','回答に使う資料にチェックを入れてください。解析が完了した資料だけを参照します。'),this.materialsEmpty,this.materials)
    const summary=el('summary','','読み取り本文・ページ別処理情報');this.evidence.append(summary,this.evidenceBody);this.evidence.hidden=true;content.append(this.evidence);this.materialsPanel.append(header,content);this.root.append(this.materialsPanel)
    if(this.toolbar)this.toolbar.append(this.materialsButton)
    else {const tools=el('div','ai-materials-toolbar');tools.append(this.materialsButton);this.root.prepend(tools)}
    this.thread.setAttribute('role','log');this.thread.setAttribute('aria-label','AIとの会話');this.thread.setAttribute('aria-live','polite');this.thread.setAttribute('aria-relevant','additions');this.root.append(this.thread)
    const welcome=el('div','ai-welcome');welcome.append(el('div','ai-mark','✦'),el('h3','','この授業の、学びの相棒。'),el('p','','資料を追加して、要約や質問から始めましょう。'),el('small','','授業ごとに会話と資料を保存します。'))
    this.thread.append(welcome)
    const suggestions=el('div','ai-suggestions')
    for(const text of ['要点をまとめて','小テストを作って','リアクションペーパーを一緒に考えて'])suggestions.append(button(text,()=>{this.textarea.value=text;this.textarea.focus()},'ai-suggestion'))
    this.root.append(suggestions)
    this.textarea.placeholder='この授業の資料について質問する…';this.textarea.maxLength=2000;this.textarea.rows=3;this.textarea.setAttribute('aria-label','AIへのメッセージ')
    this.textarea.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();this.composer.requestSubmit()}})
    const tools=el('div','ai-composer-tools'),menu=el('details','ai-add-menu'),menuTitle=el('summary','ai-add-toggle','＋ 資料を追加'),menuBody=el('div','ai-menu-items');menu.append(menuTitle,menuBody)
    const fileInput=el('input');fileInput.type='file';fileInput.multiple=true;fileInput.accept=`${imageFileAccept},application/pdf,audio/mp4,.m4a`;fileInput.hidden=true
    menuBody.append(button('写真・PDF・音声ファイル',()=>fileInput.click(),'ai-menu-item'),button('資料メモを書く',()=>this.showNote(),'ai-menu-item'),this.recordButton)
    this.recordButton.type='button';this.recordButton.addEventListener('click',()=>void this.toggleRecording())
    this.stop.type='button';this.stop.hidden=true;this.stop.addEventListener('click',()=>this.controller?.stop());this.send.type='submit';this.send.disabled=true
    this.attachments.setAttribute('role','list');this.attachments.setAttribute('aria-label','追加した資料とアップロード状況');this.attachments.hidden=true
    this.sendWait.id=`ai-send-wait-${crypto.randomUUID()}`;this.sendWait.setAttribute('role','status');this.sendWait.hidden=true;this.textarea.setAttribute('aria-describedby',this.sendWait.id)
    tools.append(menu,this.stop,this.send);this.composer.append(this.attachments,this.sendWait,this.textarea,tools,fileInput)
    this.composer.addEventListener('submit',e=>{e.preventDefault();if(this.send.disabled)return;const text=this.textarea.value;if(!text.trim())return;void this.perform(async()=>{const sent=await this.controller!.send(text);if(sent&&!this.disposed&&this.textarea.value===text)this.textarea.value=''})})
    fileInput.addEventListener('change',()=>{const files=[...fileInput.files??[]];fileInput.value='';void this.addFiles(files);menu.open=false})
    this.root.addEventListener('dragover',e=>{e.preventDefault();this.root.classList.add('ai-dragging')})
    this.root.addEventListener('dragleave',()=>this.root.classList.remove('ai-dragging'))
    this.root.addEventListener('drop',e=>{e.preventDefault();this.root.classList.remove('ai-dragging');void this.addFiles([...e.dataTransfer?.files??[]])})
    const caption=el('small','ai-composer-caption','Enterで送信 · Shift＋Enterで改行 · AIの回答は原資料と照合してください。');this.root.append(this.status,this.composer,caption)
    try{
      const context=this.context??await resolveContext(this.course,this.store,this.uid),canonical=offeringId(context)
      if(this.disposed)return
      identity.textContent=canonical?`${canonical} · ${context.semester==='fall'?'後期':context.semester==='spring'?'前期':'学期未確定'}`:context.year?`${context.year}年度・授業ID未確定（端末の授業IDで保持）`:'授業年度未確定（現在年では補完しません）'
      identity.title=courseKey(context)
      this.controller=new AIController(this.uid,context,this.backend,this.store,()=>this.render());await this.controller.init();this.render()
    }catch(e){this.initError=safeError(e);this.status.textContent=this.initError}
  }
  private openMaterials(){if(this.disposed||this.materialsPanel.open)return;this.materialsButton.setAttribute('aria-expanded','true');this.materialsPanel.showModal()}
  private async perform(action:()=>Promise<unknown>){try{await action()}catch(e){if(!this.disposed)this.status.textContent=safeError(e)}}
  private async addFiles(files:File[]){
    if(!this.controller||this.disposed)return
    // Persist the prepared upload bytes before cloud admission; retries reuse that same copy.
    for(const file of files.slice(0,8)){
      if(this.disposed)break
      if(isHEIC(file,file.name))this.status.textContent='HEIC/HEIFをこの端末でJPEGに変換しています…'
      await this.perform(async()=>{const row=await this.controller!.stageFile(file);this.recentAttachments.add(row.id);this.render()})
    }
    if(files.length>8)this.status.textContent='一度に追加できる資料は8件までです。'
  }
  private showNote(){
    if(!this.controller)return
    const menu=this.root.querySelector<HTMLDetailsElement>('.ai-add-menu');if(menu)menu.open=false
    const dialog=el('dialog','ai-note-dialog'),form=el('form'),label=el('label','','資料メモ'),input=el('textarea');input.rows=8;input.maxLength=10000;input.required=true;input.setAttribute('aria-label','資料メモの本文');label.append(input)
    const actions=el('div','ai-note-actions'),cancel=button('キャンセル',()=>dialog.close()),save=el('button','ai-send','資料として保存');save.type='submit';actions.append(cancel,save);form.append(label,actions)
    form.addEventListener('submit',e=>{e.preventDefault();save.disabled=true;void this.perform(async()=>{await this.controller!.stageNote(input.value);dialog.close()}).finally(()=>{save.disabled=false})})
    dialog.append(form);dialog.addEventListener('close',()=>dialog.remove(),{once:true});this.root.append(dialog);dialog.showModal();input.focus()
  }
  private async toggleRecording(){
    if(this.record?.state==='recording'){this.record.stop();return}
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'||!MediaRecorder.isTypeSupported('audio/mp4'))throw Error('WEB_このブラウザではm4a録音に対応していません。m4aファイルを追加してください。')
      this.audio=await navigator.mediaDevices.getUserMedia({audio:true});if(this.disposed){this.audio.getTracks().forEach(x=>x.stop());return}
      const chunks:Blob[]=[];this.record=new MediaRecorder(this.audio,{mimeType:'audio/mp4'})
      this.record.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
      this.record.onstop=()=>{clearTimeout(this.recordTimer);this.audio?.getTracks().forEach(x=>x.stop());this.recordButton.textContent='録音を開始';if(!this.disposed&&chunks.length)void this.addFiles([new File(chunks,`録音-${new Date().toISOString().slice(0,16).replace(':','-')}.m4a`,{type:'audio/mp4'})])}
      this.record.onerror=()=>{this.audio?.getTracks().forEach(x=>x.stop());this.status.textContent='録音が中断されました。端末のマイク設定を確認してください。'}
      this.record.start(1000);this.recordButton.textContent='■ 録音を終了して追加';this.status.textContent='録音中です（最長15分）。画面を閉じると録音を破棄します。';this.recordTimer=setTimeout(()=>this.record?.state==='recording'&&this.record.stop(),900000)
    }catch(e){this.status.textContent=(e as DOMException)?.name==='NotAllowedError'?'マイクの使用が許可されていません。ファイルから音声を追加できます。':safeError(e)}
  }
  private render(){
    const c=this.controller;if(!c||this.disposed)return
    const nearBottom=this.thread.scrollHeight-this.thread.scrollTop-this.thread.clientHeight<100
    this.status.textContent=c.error||this.initError||(c.loading?'資料を確認しています…':c.sending?'AIが返信しています…':'')
    const waiting=c.materialWaitReason
    this.send.disabled=c.loading||c.sending||!!waiting;this.send.textContent=waiting?'資料を準備中…':'送信 ↑';this.send.title=waiting
    this.sendWait.hidden=!waiting;this.sendWait.textContent=waiting?waiting+' 文章は入力できます。':''
    this.stop.hidden=!c.sending;this.textarea.disabled=c.loading
    this.materials.replaceChildren(...c.materials.map(row=>this.material(row)))
    this.renderAttachments()
    this.materialsButton.textContent=`資料 (${c.materials.length})`;this.materialsEmpty.hidden=c.materials.length>0
    const pending=c.materials.filter(row=>['local','uploading','processing'].includes(row.state)).length
    this.materialsButton.title=pending?`${pending}件の資料を処理中です`:'この授業回の資料一覧を開く'
    if(this.selectedEvidence&&!c.materials.some(row=>row.id===this.selectedEvidence)){this.selectedEvidence=undefined;this.evidenceSignature='';this.evidenceTicket++;this.evidence.hidden=true;this.evidenceBody.replaceChildren()}
    const existing=[...this.bubbles.keys()];for(const id of existing)if(!c.messages.some(x=>x.id===id)){this.bubbles.get(id)?.remove();this.bubbles.delete(id)}
    this.thread.querySelector('.ai-welcome')?.toggleAttribute('hidden',c.messages.length>0)
    for(const message of c.messages)this.message(message)
    if(nearBottom||!this.hasAutoScrolled){this.thread.scrollTop=this.thread.scrollHeight;this.hasAutoScrolled=true}
    const selected=c.materials.find(x=>x.id===this.selectedEvidence)
    const completed=selected?.remote?.previewProgress?.completed??0
    const signature=selected?.remote?`${selected.id}:${selected.remote.status}:${selected.remote.activeVersion}:${selected.remote.previewVersion}:${completed}`:''
    if(selected?.remote&&(['ready','partial_ready'].includes(selected.remote.status)||completed>0)&&signature!==this.evidenceSignature){this.evidenceSignature=signature;void this.loadEvidence(selected.id)}
  }
  private material(row:LocalMaterial){
    const c=this.controller!,card=el('div','ai-material'),header=el('div','ai-material-row'),check=el('input');check.type='checkbox';check.checked=c.selected.has(row.id);check.disabled=row.state!=='ready';check.setAttribute('aria-label',`${row.title}を回答に参照する`)
    check.addEventListener('change',()=>{if(check.checked&&c.selected.size>=8){check.checked=false;this.status.textContent='参照する資料は8件まで選択できます。';return}if(check.checked){c.selected.add(row.id);this.dismissedAttachments.delete(row.id)}else c.selected.delete(row.id);this.renderAttachments()})
    const detail=materialProgress(row,c.uploadProgress.get(row.id)),title=el('span','ai-material-title',row.title),status=el('span','ai-material-status',detail.label);header.append(check,title,status);card.append(header)
    if(row.state==='uploading'){const p=el('progress');p.max=100;p.value=c.uploadProgress.get(row.id)??0;p.setAttribute('aria-label','アップロード進捗');card.append(p)}
    if(row.error)card.append(el('p','ai-material-error',row.error))
    const actions=el('div','ai-material-actions')
    if(row.remote&&(row.state==='ready'||(row.remote.previewProgress?.completed??0)>0))actions.append(button(row.state==='ready'?'本文':'途中結果・検索対象外',()=>{this.selectedEvidence=row.id;this.evidenceSignature='';void this.loadEvidence(row.id)}))
    if(row.state==='failed'||row.state==='local')actions.append(button('再送',()=>void this.perform(()=>c.retry(row.id))))
    if(row.state==='ready'){const ask=button('この資料について聞く',()=>{c.selected.clear();c.selected.add(row.id);this.materialsPanel.close();this.textarea.focus();void this.perform(()=>c.send('','intro'))});ask.disabled=c.loading||c.sending||!!c.materialWaitReason;ask.title=c.materialWaitReason;actions.append(ask)}
    actions.append(button('削除',()=>{if(confirm(`「${row.title}」を削除しますか？ AIに保存された本文と原本も削除します。`))void this.perform(()=>c.delete(row.id))}))
    card.append(actions);return card
  }
  private renderAttachments(){
    const c=this.controller;if(!c||this.disposed)return
    const rows=c.materials.filter(row=>!row.wantsDeletion&&row.state!=='deleting'&&!this.dismissedAttachments.has(row.id)&&(this.recentAttachments.has(row.id)||c.selected.has(row.id)||row.state!=='ready'))
    const ids=new Set(rows.map(row=>row.id))
    for(const [id,entry]of this.thumbnails)if(!ids.has(id)){URL.revokeObjectURL(entry.url);this.thumbnails.delete(id)}
    for(const [id,card]of this.attachmentCards)if(!ids.has(id)){card.remove();this.attachmentCards.delete(id)}
    for(const row of rows){
      let card=this.attachmentCards.get(row.id)
      if(!card){
        card=el('div','ai-attachment-card');card.setAttribute('role','listitem')
        const open=button('',()=>this.openMaterials(),'ai-attachment-open'),preview=el('span','ai-attachment-preview'),image=el('img'),kind=el('span','ai-attachment-kind'),info=el('span','ai-attachment-info'),name=el('strong','ai-attachment-name'),state=el('span','ai-attachment-status')
        image.loading='lazy';image.decoding='async';image.width=48;image.height=48;image.hidden=true;image.onerror=()=>{image.hidden=true;kind.hidden=false}
        state.setAttribute('role','status');preview.append(image,kind);info.append(name,state);open.append(preview,info)
        const progress=el('progress');progress.max=100;progress.setAttribute('aria-label','資料のアップロード進捗')
        const tools=el('div','ai-attachment-tools'),retry=button('再送',()=>void this.perform(()=>c.retry(row.id)),'ai-small-button ai-attachment-retry'),dismiss=button('回答から外す',()=>{c.selected.delete(row.id);this.recentAttachments.delete(row.id);this.dismissedAttachments.add(row.id);this.render()},'ai-small-button ai-attachment-dismiss')
        tools.append(retry,dismiss);card.append(open,progress,tools);this.attachmentCards.set(row.id,card)
      }
      const awaiting=row.state==='processing'&&row.remote?.status==='awaiting_upload'
      card.dataset.state=awaiting?'awaiting_upload':row.state
      const name=card.querySelector<HTMLElement>('.ai-attachment-name')!,open=card.querySelector<HTMLButtonElement>('.ai-attachment-open')!,state=card.querySelector<HTMLElement>('.ai-attachment-status')!,image=card.querySelector<HTMLImageElement>('img')!,kind=card.querySelector<HTMLElement>('.ai-attachment-kind')!,progress=card.querySelector<HTMLProgressElement>('progress')!
      name.textContent=row.title;name.title=row.title;open.setAttribute('aria-label',`${row.title}を資料一覧で確認`)
      kind.textContent={image:'写真',pdf:'PDF',audio:'音声',note:'メモ'}[row.type];image.alt=`${row.title}のサムネイル`
      const file=row.file,canPreview=row.type==='image'&&file&&/^image\/(jpeg|png|webp)$/.test(file.type||row.mime)
      if(canPreview){
        let entry=this.thumbnails.get(row.id)
        if(entry?.file!==file){if(entry)URL.revokeObjectURL(entry.url);entry={file,url:URL.createObjectURL(file)};this.thumbnails.set(row.id,entry)}
        if(image.getAttribute('src')!==entry.url){image.src=entry.url;image.hidden=false;kind.hidden=true}
      }else{image.hidden=true;kind.hidden=false;image.removeAttribute('src')}
      const detail=materialProgress(row,c.uploadProgress.get(row.id)),description=detail.label+(row.state==='ready'&&!c.selected.has(row.id)?'・回答対象外':'')
      if(state.textContent!==description)state.textContent=description
      progress.hidden=!detail.progress;progress.max=detail.progress?.max??100;progress.setAttribute('aria-label',detail.progress?.description??'資料の進捗')
      if(detail.progress?.value===undefined)progress.removeAttribute('value');else progress.value=detail.progress.value
      card.querySelector<HTMLButtonElement>('.ai-attachment-retry')!.hidden=row.state!=='failed'&&!awaiting
      const dismiss=card.querySelector<HTMLButtonElement>('.ai-attachment-dismiss')!;dismiss.hidden=row.state!=='ready';dismiss.textContent=c.selected.has(row.id)?'回答から外す':'表示を閉じる'
    }
    const cards=rows.map(row=>this.attachmentCards.get(row.id)!)
    if(cards.length!==this.attachments.children.length||cards.some((card,i)=>this.attachments.children[i]!==card))this.attachments.replaceChildren(...cards)
    this.attachments.hidden=cards.length===0
  }
  private message(message:Message){
    let bubble=this.bubbles.get(message.id)
    if(!bubble){bubble=el('article',`ai-message ai-message--${message.role}`);bubble.append(el('p','ai-message-role',message.role==='assistant'?'✦ AIハック':'あなた'),el('div','ai-message-text'),el('small','ai-message-state'));this.thread.append(bubble);this.bubbles.set(message.id,bubble)}
    bubble.querySelector('.ai-message-text')!.textContent=message.text||(message.state==='sending'?'考えています…':'')
    bubble.querySelector('.ai-message-state')!.textContent=message.state==='sending'?'返信中…':message.state==='failed'?'送信に失敗しました。再送は自動で行いません。':message.state==='interrupted'?'中断した返信（未完了）':message.recognition?metadataText(message.recognition):''
    if(message.role==='assistant'){
      let actions=bubble.querySelector<HTMLElement>('.ai-message-actions')
      if(!actions){
        actions=el('div','ai-message-actions');const feedback=el('span','ai-message-action-status');feedback.setAttribute('role','status')
        const copy=button('コピー',()=>void this.exportAnswer(message.id,false),'ai-small-button ai-answer-copy'),share=button('共有',()=>void this.exportAnswer(message.id,true),'ai-small-button ai-answer-share')
        copy.setAttribute('aria-label','このAI回答をコピー');share.setAttribute('aria-label','このAI回答を共有');actions.append(copy,share,feedback);bubble.append(actions)
      }
      actions.hidden=message.state!=='done'||!message.text.trim()
    }
  }
  private async exportAnswer(id:string,sharing:boolean){
    const message=this.controller?.messages.find(row=>row.id===id),actions=this.bubbles.get(id)?.querySelector<HTMLElement>('.ai-message-actions')
    if(this.disposed||!message||message.role!=='assistant'||message.state!=='done'||!message.text.trim()||!actions)return
    const action=actions.querySelector<HTMLButtonElement>(sharing?'.ai-answer-share':'.ai-answer-copy')!,feedback=actions.querySelector<HTMLElement>('.ai-message-action-status')!
    if(action.disabled)return
    action.disabled=true
    try{
      const result=sharing?await shareAnswer(message.text,`${this.course.title}のAI回答`):(await copyAnswer(message.text),'copied' as const)
      if(!this.disposed)feedback.textContent=result==='cancelled'?'共有をキャンセルしました':result==='shared'?'共有画面に渡しました':sharing?'共有に未対応のため回答をコピーしました':'コピーしました'
    }catch{if(!this.disposed)feedback.textContent=sharing?'共有できませんでした。「コピー」をお試しください。':'コピーできませんでした。本文を選択してコピーしてください。'}
    finally{action.disabled=false}
  }
  private async loadEvidence(id:string){
    const c=this.controller,row=c?.materials.find(x=>x.id===id);if(!c||!row?.remote)return
    const ticket=++this.evidenceTicket,preview=!['ready','partial_ready'].includes(row.remote.status)
    this.evidence.hidden=false;this.evidence.open=true;this.evidenceBody.replaceChildren(el('p','','本文を取得しています…'))
    try{
      const value=await c.evidence(id,preview);if(this.disposed||ticket!==this.evidenceTicket)return
      // Never append probe/native text to an AI-selected page. Render canonical API chunks only.
      this.renderEvidence(value,preview)
    }catch(e){if(!this.disposed&&ticket===this.evidenceTicket&&!abortableError(e))this.evidenceBody.replaceChildren(el('p','',safeError(e)))}
  }
  private renderEvidence(value:Evidence,preview:boolean){
    const body=el('div'),caption=el('p','ai-evidence-caption',preview?'途中結果・検索対象外':'解析完了・検索対象');body.append(caption,el('pre','ai-evidence-text',evidenceText(value.items)))
    if(!preview)body.append(el('pre','ai-metadata',metadataText(value.recognition)))
    body.append(el('p','ai-pipeline',value.pipelineVersion??'旧資料（保存済み本文）'))
    for(const page of value.recognition?.routing?.pages??[])body.append(el('p','ai-page-route',`${page.pageNumber?`p.${page.pageNumber}`:'画像'} · ${page.route} · ${page.provider} / ${page.model??'対象外'}`))
    if(value.latency){const labels:Record<string,string>={uploadMs:'送信',queueWaitMs:'待機',workerStartupMs:'起動',routerMs:'Router',nativeExtractionMs:'本文抽出',ocrProbeMs:'OCR probe',ocrMs:'OCR',aiMs:'AI',persistenceMs:'保存',evidenceMs:'本文取得',totalProcessingMs:'worker全体'};const lines=Object.entries(labels).map(([key,label])=>`${label}: ${typeof value.latency![key]==='number'?(Number(value.latency![key])/1000).toFixed(2)+'秒':'未計測'}`);body.append(el('pre','ai-metadata',lines.join('\n')))}
    this.evidenceBody.replaceChildren(body)
  }
  dispose(){this.disposed=true;for(const entry of this.thumbnails.values())URL.revokeObjectURL(entry.url);this.thumbnails.clear();this.attachmentCards.clear();if(this.materialsPanel.open)this.materialsPanel.close();this.materialsButton.remove();this.controller?.dispose();clearTimeout(this.recordTimer);if(this.record?.state==='recording')this.record.stop();this.audio?.getTracks().forEach(x=>x.stop());this.root.querySelectorAll('dialog').forEach(x=>x.remove())}
}
