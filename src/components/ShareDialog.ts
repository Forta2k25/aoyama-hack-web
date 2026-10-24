import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { buildSharedTimetable, publishShare, stopShare, storedShareId, shareUrl } from '../sharedTimetable'
import { loadTimetableSettings, visibleGrid } from '../timetableSettings'
import type { TimetableSlot } from '../timetable'

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** 共有ボタン。時間割を公開URLにして、友達に送る(「〇〇さんの時間割」として開く) */
export function openShareDialog(uid: string, term: string, slots: TimetableSlot[]): void {
  document.getElementById('share-dialog-root')?.remove()
  const root = document.createElement('div')
  root.id = 'share-dialog-root'
  root.className = 'shd-root'
  document.body.appendChild(root)
  const close = () => { root.remove(); document.removeEventListener('keydown', onKey) }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)

  let name = ''
  const paint = (inner: string) => {
    root.innerHTML = `<div class="shd-dim" data-close></div><div class="shd-card" role="dialog" aria-label="時間割を共有"><button class="shd-x" type="button" data-close aria-label="閉じる">×</button>${inner}</div>`
    root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close))
  }

  const showLink = (id: string, justPublished: boolean) => {
    const url = shareUrl(id)
    paint(`
      <h2>時間割を共有</h2>
      <p class="shd-lead">${justPublished ? 'URLをつくりました。' : '共有中です。'}このURLを友達に送ると、「${escapeHtml(name)}さんの時間割」として開けます(ログイン不要)。</p>
      <input class="shd-url" id="shd-url" type="text" readonly value="${url}">
      <div class="shd-actions">
        <button class="btn btn-primary" id="shd-copy" type="button">URLをコピー</button>
        ${typeof navigator.share === 'function' ? '<button class="btn btn-ghost" id="shd-native" type="button">送る…</button>' : ''}
      </div>
      <div class="shd-actions">
        <button class="btn btn-ghost" id="shd-update" type="button">いまの時間割に更新</button>
        <button class="btn btn-ghost shd-danger" id="shd-stop" type="button">共有をやめる</button>
      </div>
      <p class="shd-note">URLを知っている人は誰でも見られます(授業名・教室・色のみ。先生名やメモは含みません)。更新するとURLはそのままで中身が最新になります。</p>`)
    const copy = root.querySelector<HTMLButtonElement>('#shd-copy')!
    copy.addEventListener('click', () => {
      const input = root.querySelector<HTMLInputElement>('#shd-url')!
      void (navigator.clipboard?.writeText(url) ?? Promise.reject()).catch(() => { input.select(); document.execCommand('copy') })
      copy.textContent = 'コピーしました'
    })
    root.querySelector('#shd-native')?.addEventListener('click', () => {
      void navigator.share({ title: `${name}さんの時間割`, text: `${name}さんの時間割です`, url }).catch(() => { /* 取り消し */ })
    })
    root.querySelector('#shd-update')?.addEventListener('click', () => { void publish() })
    root.querySelector('#shd-stop')?.addEventListener('click', () => {
      if (!window.confirm('共有をやめると、このURLは見られなくなります。よろしいですか?')) return
      void stopShare(uid, term).then(close).catch(() => window.alert('共有をやめられませんでした。通信を確認して、もう一度お試しください。'))
    })
  }

  const publish = async () => {
    paint('<h2>時間割を共有</h2><div class="mypage-loading"><div class="mypage-spinner"></div><span>URLをつくっています...</span></div>')
    try {
      const settings = loadTimetableSettings()
      const grid = visibleGrid(settings, slots)
      const data = buildSharedTimetable(uid, name, term, slots, grid.periods.length, grid.days.length === 6)
      const id = await publishShare(term, data)
      showLink(id, true)
    } catch {
      paint('<h2>時間割を共有</h2><p class="shd-lead">共有できませんでした。通信を確認して、もう一度お試しください。</p><div class="shd-actions"><button class="btn btn-ghost" data-close type="button">閉じる</button></div>')
      root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close))
    }
  }

  paint('<h2>時間割を共有</h2><div class="mypage-loading"><div class="mypage-spinner"></div></div>')
  void getDoc(doc(db, 'users', uid)).then((snap) => {
    name = String((snap.data() as { name?: string } | undefined)?.name ?? '').trim() || '友だち'
    const id = storedShareId(uid, term)
    if (id) { showLink(id, false); return }
    paint(`
      <h2>時間割を共有</h2>
      <p class="shd-lead">公開URLをつくって、友達に送れます。「${escapeHtml(name)}さんの時間割」として開き、ログインは不要です。</p>
      <p class="shd-note">共有されるのは、授業名・教室・色だけです。</p>
      <div class="shd-actions"><button class="btn btn-primary" id="shd-make" type="button">共有URLをつくる</button></div>`)
    root.querySelector('#shd-make')?.addEventListener('click', () => { void publish() })
  }).catch(() => {
    paint('<h2>時間割を共有</h2><p class="shd-lead">読み込めませんでした。もう一度お試しください。</p>')
  })
}
