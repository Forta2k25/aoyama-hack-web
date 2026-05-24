import type { Handler } from '@netlify/functions'

// syllabus.aoyama.ac.jp の CORS プロキシ
const handler: Handler = async (event) => {
  const url = event.queryStringParameters?.url ?? ''

  if (
    !url.startsWith('https://syllabus.aoyama.ac.jp') &&
    !url.startsWith('http://syllabus.aoyama.ac.jp')
  ) {
    return { statusCode: 403, body: 'Forbidden' }
  }

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en',
        'User-Agent': 'Mozilla/5.0 (compatible; AoyamaHack/1.0)',
      },
    })

    if (!res.ok) {
      return { statusCode: res.status, body: `Upstream error: ${res.status}` }
    }

    const html = await res.text()
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
      body: html,
    }
  } catch {
    return { statusCode: 502, body: 'Fetch failed' }
  }
}

export { handler }
