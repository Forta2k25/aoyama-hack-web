/** HEIC decoding stays in the browser; only the JPEG copy reaches the existing API. */
export const imageFileAccept='image/jpeg,image/png,image/webp,image/heic,image/heif,image/heic-sequence,image/heif-sequence,.jpg,.jpeg,.png,.webp,.heic,.heif'
export function isHEIC(file:Blob,name:string):boolean {
  return /^image\/hei[cf](?:-sequence)?$/i.test(file.type)||/\.hei[cf]$/i.test(name)
}
const conversionError=()=>Error('WEB_HEIC/HEIFを読み込めませんでした。別の写真で試すか、JPEGに書き出して追加してください。')

function abortable<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort)}
    const abort=()=>{cleanup();reject(signal.reason)}
    const timer=setTimeout(()=>{cleanup();reject(Error('WEB_HEICの変換がタイムアウトしました。写真をもう一度選択してください。'))},60000)
    signal.addEventListener('abort',abort,{once:true})
    work.then(value=>{cleanup();resolve(value)},error=>{cleanup();reject(error)})
    if(signal.aborted)abort()
  })
}
export async function prepareImageUpload(file:File,signal:AbortSignal):Promise<File>{
  signal.throwIfAborted()
  if(!isHEIC(file,file.name))return file
  let image:Blob
  try {
    const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer())
    signal.throwIfAborted()
    // Some Apple pickers already transcode the bytes but retain the HEIC filename.
    if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)image=file.slice(0,file.size,'image/jpeg')
    else if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))image=file.slice(0,file.size,'image/png')
    else image=await abortable(import('heic-to/csp').then(({heicTo})=>heicTo({blob:file,type:'image/jpeg',quality:0.95})),signal)
    signal.throwIfAborted()
    if(!image.size||!['image/jpeg','image/png'].includes(image.type))throw conversionError()
    const header=new Uint8Array(await image.slice(0,8).arrayBuffer())
    const valid=image.type==='image/jpeg'?header[0]===0xff&&header[1]===0xd8&&header[2]===0xff:[137,80,78,71,13,10,26,10].every((v,i)=>header[i]===v)
    if(!valid)throw conversionError()
  }catch(error){signal.throwIfAborted();if(error instanceof Error&&error.message.startsWith('WEB_'))throw error;throw conversionError()}
  signal.throwIfAborted()
  if(image.size>20*1024*1024)throw Error('WEB_HEIC変換後の画像が20MBを超えました。小さめのJPEGに書き出して追加してください。')
  const ext=image.type==='image/png'?'.png':'.jpg',name=file.name.replace(/\.[^.]*$/,'')+ext
  return new File([image],name,{type:image.type,lastModified:file.lastModified})
}
