import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, googleProvider } from './firebase'

export type AuthUser = User | null

let currentUser: AuthUser = null
const listeners: Array<(user: AuthUser) => void> = []

onAuthStateChanged(auth, (user) => {
  currentUser = user
  listeners.forEach((fn) => fn(user))
})

export const getUser = () => currentUser

export const onUserChange = (fn: (user: AuthUser) => void) => {
  listeners.push(fn)
  fn(currentUser)
  return () => {
    const idx = listeners.indexOf(fn)
    if (idx !== -1) listeners.splice(idx, 1)
  }
}

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider)

export const signOutUser = () => signOut(auth)
