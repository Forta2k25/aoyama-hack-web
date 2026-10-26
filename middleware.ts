import { next } from '@vercel/functions'

/**
 * 確認用サイトの Basic 認証。
 * Vercel の環境変数 SITE_PASSWORD を入れた環境(Preview など)でだけ働く。入れていない環境(本番など)は、何もしない。
 * ユーザー名は SITE_USER(なければ "hack")。友達に送る時間割の共有ページ(/t/…)と、その表示に要る /assets/ は、パスワードなしで開く。
 */
export const config = { matcher: '/((?!api/).*)' }

const open = (path: string) => path.startsWith('/t/') || path.startsWith('/assets/')

// 長さに関わらず、同じ手間で比べる(パスワードの先頭から当てられないように)
function same(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export default function middleware(request: Request) {
  const password = process.env.SITE_PASSWORD
  if (!password) return next({ headers: { 'x-site-auth': 'off' } })
  if (open(new URL(request.url).pathname)) return next({ headers: { 'x-site-auth': 'open' } })
  const header = request.headers.get('authorization') ?? ''
  if (header.startsWith('Basic ')) {
    try {
      const decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), c => c.charCodeAt(0)))
      const colon = decoded.indexOf(':')
      const user = process.env.SITE_USER || 'hack'
      if (colon >= 0 && same(decoded.slice(0, colon), user) && same(decoded.slice(colon + 1), password)) return next({ headers: { 'x-site-auth': 'ok' } })
    } catch { /* 壊れた認証ヘッダーは、不一致として扱う */ }
  }
  return new Response('パスワードが必要です', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Aoyama Hack", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
