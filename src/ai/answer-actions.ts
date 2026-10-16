/** Export only the answer text, never page URLs, source attachments or private config. */
export async function copyAnswer(text:string):Promise<void>{
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return}
  const field=document.createElement('textarea'),focused=document.activeElement
  field.value=text;field.readOnly=true;field.setAttribute('aria-hidden','true');field.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(field)
  try{field.select();if(!document.execCommand?.('copy'))throw Error('COPY_UNAVAILABLE')}
  finally{field.remove();if(focused instanceof HTMLElement)focused.focus({preventScroll:true})}
}
export async function shareAnswer(text:string,title:string):Promise<'shared'|'copied'|'cancelled'>{
  const data={title,text}
  if(navigator.share&&(!navigator.canShare||navigator.canShare(data))){
    try{await navigator.share(data);return 'shared'}
    catch(error){if((error as {name?:string})?.name==='AbortError')return 'cancelled';throw error}
  }
  await copyAnswer(text);return 'copied'
}
