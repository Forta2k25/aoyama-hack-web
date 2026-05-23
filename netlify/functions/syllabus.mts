import type { Context } from '@netlify/functions'

// syllabus.aoyama.ac.jp のページを CORS プロキシとして返す
export default async (req: Request, _ctx: Context) => {
  const url = new URL(req.url).searchParams.get('url') ?? ''

  // セキュリティ: 青山学院のシラバスURLのみ許可
  if (!url.startsWith('https://syllabus.aoyama.ac.jp') && !url.startsWith('http://syllabus.aoyama.ac.jp')) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en',
        'User-Agent': 'Mozilla/5.0 (compatible; AoyamaHack/1.0)',
      },
    })

    if (!res.ok) return new Response(`Upstream error: ${res.status}`, { status: res.status })

    const html = await res.text()
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e) {
    return new Response('Fetch failed', { status: 502 })
  }
}
