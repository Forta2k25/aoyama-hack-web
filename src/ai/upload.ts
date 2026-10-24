import type { Upload } from './types'
export function validateUpload(upload: Upload, uid: string): URL {
  const url=new URL(upload.url)
  if (url.protocol!=='https:' || url.hostname!=='storage.googleapis.com' || url.port || url.username || url.password ||
      !decodeURIComponent(url.pathname).startsWith(`/forta-aogaku.firebasestorage.app/ai-inputs/aogaku-ai/${uid}/`) ||
      decodeURIComponent(url.pathname).split('/').some(p=>p==='..')) throw Error('WEB_送信先が許可されたStorageではありません。')
  for(const key of Object.keys(upload.headers ?? {})) if(!/^(content-type|content-md5|x-goog-if-generation-match|x-goog-content-length-range)$/i.test(key)) throw Error('WEB_送信ヘッダーが契約と一致しません。')
  return url
}
