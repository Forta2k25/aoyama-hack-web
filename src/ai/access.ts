// UI visibility is never authorization: callable Auth/owner/pilot gates remain authoritative.
export function aiEnabled(build: boolean, hostname: string): boolean {
  return build && !['aoyamahack.com','www.aoyamahack.com','aoyama-hack-web.vercel.app'].includes(hostname.toLowerCase())
}
export const webAIEnabled = () => aiEnabled(__WEB_AI_PREVIEW_BUILD__, location.hostname)
