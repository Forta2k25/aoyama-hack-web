import type { VercelRequest, VercelResponse } from '@vercel/node'

// syllabus.aoyama.ac.jp の CORS プロキシ
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = (req.query.url as string) ?? ''

  if (
    !url.startsWith('https://syllabus.aoyama.ac.jp') &&
    !url.startsWith('http://syllabus.aoyama.ac.jp')
  ) {
    return res.status(403).send('Forbidden')
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en',
        'User-Agent': 'Mozilla/5.0 (compatible; AoyamaHack/1.0)',
      },
    })

    const html = await upstream.text()
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(upstream.status).send(html)
  } catch {
    return res.status(502).send('Fetch failed')
  }
}
