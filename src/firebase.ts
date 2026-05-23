import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase Console → プロジェクトの設定 → マイアプリ → Web のconfigをここに貼る
const firebaseConfig = {
  apiKey: 'AIzaSyDk_rZlVOJpMB45r2yzfYr-U5ZfbL_8l54',
  authDomain: 'forta-aogaku.firebaseapp.com',
  projectId: 'forta-aogaku',
  storageBucket: 'forta-aogaku.firebasestorage.app',
  messagingSenderId: '505828754933',
  appId: '1:505828754933:web:beddd35a93764aa1e38cbc',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
