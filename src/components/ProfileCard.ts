import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { termLabel } from '../timetable'

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

interface Profile { name: string; id: string; grade?: number; faculty?: string; department?: string }

export async function fetchProfile(uid: string): Promise<Profile> {
  const snap = await getDoc(doc(db, 'users', uid))
  const x = (snap.data() ?? {}) as Record<string, unknown>
  return {
    name: String(x['name'] ?? '').trim() || '名前なし',
    id: String(x['id'] ?? ''),
    grade: typeof x['grade'] === 'number' ? x['grade'] : undefined,
    faculty: typeof x['faculty'] === 'string' ? x['faculty'] : undefined,
    department: typeof x['department'] === 'string' ? x['department'] : undefined,
  }
}

/** 友だちタブの上に出す、自分のプロフィール。右の3本線に、規約・お問い合わせ・ログアウト・アカウント削除 */
export function profileCardMarkup(profile: Profile, avatarHtml: string): string {
  const meta = [profile.faculty, profile.department, profile.grade ? `${profile.grade}年` : ''].filter(Boolean).join(' ')
  return `
    <div class="profile-card">
      ${avatarHtml}
      <div class="friend-info">
        <span class="friend-name">${escapeHtml(profile.name)}</span>
        ${profile.id ? `<span class="friend-handle">@${escapeHtml(profile.id)}</span>` : ''}
        ${meta ? `<span class="profile-meta">${escapeHtml(meta)}</span>` : ''}
      </div>
      <div class="profile-menu-wrap">
        <button class="profile-menu-btn" id="profile-menu-btn" type="button" aria-label="メニュー" aria-expanded="false">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div class="profile-menu" id="profile-menu" hidden>
          <a href="/terms" target="_blank" rel="noopener">利用規約</a>
          <a href="/privacy-policy" target="_blank" rel="noopener">プライバシーポリシー</a>
          <a href="/contact" target="_blank" rel="noopener">お問い合わせ</a>
          <button type="button" data-profile-action="logout" class="profile-menu-danger">ログアウト</button>
          <button type="button" data-profile-action="delete" class="profile-menu-danger">アカウント削除</button>
        </div>
      </div>
    </div>`
}

export function bindProfileCard(root: HTMLElement): void {
  const btn = root.querySelector<HTMLButtonElement>('#profile-menu-btn')
  const menu = root.querySelector<HTMLElement>('#profile-menu')
  if (!btn || !menu) return
  const set = (open: boolean) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)) }
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(Boolean(menu.hidden)) })
  document.addEventListener('click', (e) => { if (!menu.contains(e.target as Node)) set(false) })
  menu.querySelector('[data-profile-action="logout"]')?.addEventListener('click', () => {
    if (!window.confirm('ログアウトしますか?')) return
    void import('../auth').then(({ signOutUser }) => signOutUser()).then(() => { window.location.href = '/' })
  })
  menu.querySelector('[data-profile-action="delete"]')?.addEventListener('click', () => {
    if (!window.confirm('アカウントを削除しますか?\n時間割・会話・友だちなど、すべてのデータが消え、取り消せません。')) return
    if (!window.confirm('本当に削除しますか?(本人確認のため、Googleでもう一度ログインします)')) return
    void import('../accountDeletion').then(({ deleteMyAccount }) => deleteMyAccount(termLabel()))
      .then(() => { window.location.href = '/' })
      .catch((e: unknown) => window.alert(`削除に失敗しました。もう一度お試しください。\n(${e instanceof Error ? e.message : '不明なエラー'})`))
  })
}
