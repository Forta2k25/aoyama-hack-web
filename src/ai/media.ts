// Read duration from the actual local media container; never infer it from file size.
export async function audioDurationSeconds(file:Blob):Promise<number>{
  const audio=document.createElement('audio'),url=URL.createObjectURL(file)
  audio.preload='metadata'
  try{return await new Promise<number>((resolve,reject)=>{
    const finish=(error?:Error)=>{clearTimeout(timer);audio.onloadedmetadata=null;audio.onerror=null;error?reject(error):resolve(audio.duration)}
    const timer=setTimeout(()=>finish(Error('WEB_音声の長さを確認できませんでした。m4aファイルを選び直してください。')),15000)
    audio.onloadedmetadata=()=>finish(Number.isFinite(audio.duration)&&audio.duration>0?undefined:Error('WEB_音声の長さを確認できません。空でないm4aファイルを選んでください。'))
    audio.onerror=()=>finish(Error('WEB_この音声を読み込めません。m4aファイルを選び直してください。'))
    audio.src=url
  })}finally{audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url)}
}
