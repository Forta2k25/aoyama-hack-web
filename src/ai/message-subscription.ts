// 会話の履歴の「変化の知らせ」だけを、リアルタイムで受け取る(読み取り専用の購読)。
// 内容は、ここでは読まない。知らせを受けたら、これまでどおり、関数(aiListMessages)から、新しい分を取る。
// ルール(Config/AI/firestore.rules)で、本人が、自分の分を読めるようにしてある。書き込みは、関数だけ。
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { auth } from '../firebase'

/** 戻り値は、購読をやめる関数。授業(courseOfferingId)の、いちばん新しく保存された発言が変わるたびに、onChange を呼ぶ。 */
export function subscribeConversation(uid: string, courseOfferingId: string, onChange: () => void): () => void {
  const db = getFirestore(auth.app, 'aogaku-ai')
  const latest = query(collection(db, 'aiChats', uid, 'offerings', courseOfferingId, 'messages'), orderBy('updatedAt', 'desc'), limit(1))
  return onSnapshot(latest, snapshot => { if (!snapshot.metadata.hasPendingWrites) onChange() }, () => { /* 購読できなくても、定期の確認が、代わりに働く */ })
}
