import type { LectureSettings } from './calendar'
import type { LocalMaterial, Message } from './types'
export class AIStore {
  private connection?: Promise<IDBDatabase>
  private db() {
    return this.connection ??= new Promise<IDBDatabase>((resolve,reject) => {
      const request = indexedDB.open('aoyamahack-web-ai-v1',2)
      request.onupgradeneeded = () => {
        const db = request.result
        for(const name of ['materials','messages'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'})
        for(const name of ['identities','schedules'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name)
      }
      request.onblocked=()=>reject(Error('WEB_別タブでAI画面が開かれています。他のタブを閉じて再読み込みしてください。'))
      request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)}; request.onerror=()=>reject(request.error)
    })
  }
  private async request<T>(name: string, mode: IDBTransactionMode, make: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db=await this.db()
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(name,mode), request=make(tx.objectStore(name)); let result:T
      request.onsuccess=()=>{result=request.result}; tx.oncomplete=()=>resolve(result)
      tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error ?? Error('Local save aborted'))
    })
  }
  async identity(uid:string, record:string):Promise<string> {
    // Read+insert in one transaction so concurrent tabs cannot assign two UUIDs.
    const db=await this.db(),key=JSON.stringify([uid,record])
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('identities','readwrite'),store=tx.objectStore('identities'),request=store.get(key);let value:string
      request.onsuccess=()=>{value=request.result ?? crypto.randomUUID();if(!request.result)store.add(value,key)}
      tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error)
    })
  }
  lookupIdentity(uid:string,record:string){return this.request<string|undefined>('identities','readonly',s=>s.get(JSON.stringify([uid,record])))}
  putMaterial(row:LocalMaterial){return this.request('materials','readwrite',s=>s.put(row))}
  putMessage(row:Message){return this.request('messages','readwrite',s=>s.put(row))}
  async materials(uid:string,key:string,sessionKey?:string){return (await this.request<LocalMaterial[]>('materials','readonly',s=>s.getAll())).filter(x=>x.uid===uid&&x.courseKey===key&&(sessionKey===undefined||x.sessionKey===sessionKey)).sort((a,b)=>a.createdAt-b.createdAt)}
  async messages(uid:string,key:string,sessionKey?:string){return (await this.request<Message[]>('messages','readonly',s=>s.getAll())).filter(x=>x.uid===uid&&x.courseKey===key&&(sessionKey===undefined||x.sessionKey===sessionKey)).sort((a,b)=>a.createdAt-b.createdAt)}
  settings(uid:string,key:string){return this.request<LectureSettings|undefined>('schedules','readonly',s=>s.get(JSON.stringify([uid,key])))}
  putSettings(uid:string,key:string,value:LectureSettings){return this.request('schedules','readwrite',s=>s.put(value,JSON.stringify([uid,key])))}
  removeMaterial(id:string){return this.request('materials','readwrite',s=>s.delete(id))}
}
