import './style.css'
import './ai/style.css'
import 'katex/dist/katex.min.css'
import { webAIEnabled } from './ai/access'

// Debug boots without importing Firebase/auth/site code: no cloud requests, even for a saved login.
if(location.pathname==='/ai-debug' && webAIEnabled()) {
  const { renderDebug }=await import('./ai/debug')
  await renderDebug()
}else {
  await import('./site')
}
