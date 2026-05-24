import { defineConfig } from 'vite'
import type { Connect } from 'vite'

export default defineConfig({
  server: {
    plugins: [],
  },
  plugins: [
    {
      name: 'vercel-api-dev',
      configureServer(server) {
        server.middlewares.use(
          async (req: Connect.IncomingMessage, res, next) => {
            if (!req.url?.startsWith('/api/syllabus')) return next()
            const urlParam = new URL(req.url, 'http://localhost').searchParams.get('url') ?? ''
            if (
              !urlParam.startsWith('https://syllabus.aoyama.ac.jp') &&
              !urlParam.startsWith('http://syllabus.aoyama.ac.jp')
            ) {
              res.statusCode = 403
              res.end('Forbidden')
              return
            }
            try {
              const upstream = await fetch(urlParam, {
                headers: {
                  'Accept': 'text/html,application/xhtml+xml',
                  'Accept-Language': 'ja,en',
                  'User-Agent': 'Mozilla/5.0 (compatible; AoyamaHack/1.0)',
                },
              })
              const html = await upstream.text()
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.statusCode = upstream.status
              res.end(html)
            } catch {
              res.statusCode = 502
              res.end('Fetch failed')
            }
          }
        )
      },
    },
  ],
})
