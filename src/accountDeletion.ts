// アカウント削除。アプリの AuthManager.deleteAccount と同じ順番:
// 本人確認(再ログイン) → サーバーの事前掃除(preDeleteCleanup) → users の書類を削除 → ログイン情報を削除。
// そのあとのサーバー側の最終掃除は、ログイン情報の削除をきっかけに、サーバーが行う(onAuthUserDelete)。
import { reauthenticateWithPopup, deleteUser } from 'firebase/auth'
import { doc, deleteDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth, db, googleProvider } from './firebase'
import { stopShare } from './sharedTimetable'

export async function deleteMyAccount(term: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('ログインしていません')
  const uid = user.uid
  await reauthenticateWithPopup(user, googleProvider)
  // 公開中の共有URLは、先に止める(アカウントを消したあとに、残さない)
  await stopShare(uid, term).catch(() => { /* 共有していなければ、何もしない */ })
  const prepared = await httpsCallable<{ uid: string }, { ok?: boolean; aiAccountDeletionVersion?: number }>(
    getFunctions(auth.app, 'asia-northeast1'), 'preDeleteCleanup', { timeout: 120000 })({ uid })
  if (prepared.data?.ok !== true || prepared.data.aiAccountDeletionVersion !== 1) throw new Error('削除の準備が完了していません。時間を置いて、もう一度お試しください。')
  await deleteDoc(doc(db, 'users', uid)).catch(() => { /* 無くても、続ける(アプリと同じ) */ })
  await deleteUser(user)
}
