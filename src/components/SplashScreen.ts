export const SPLASH_ID = 'splash'
export const SITE_SHELL_ID = 'site-shell'

const PARTICLE_COUNT = 14

const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (360 / PARTICLE_COUNT) * i
  return `<span class="splash-particle" style="--angle:${angle}deg;--delay:${(i % 7) * 0.12}s"></span>`
}).join('')

export const splashMarkup = `
  <div id="${SPLASH_ID}" class="splash" aria-label="Aoyama Hack splash">
    <div class="splash-light"></div>
    <div class="splash-ripple splash-ripple-1"></div>
    <div class="splash-ripple splash-ripple-2"></div>
    <div class="splash-ripple splash-ripple-3"></div>
    <div class="splash-particles" aria-hidden="true">${particles}</div>
    <div class="splash-logo-wrap">
      <p class="splash-main">青山</p>
      <p class="splash-sub">ハック</p>
      <p class="splash-tag">Aoyama Hack</p>
    </div>
  </div>
`

export const startSplashTransition = () => {
  const splash = document.querySelector<HTMLElement>(`#${SPLASH_ID}`)
  const siteShell = document.querySelector<HTMLElement>(`#${SITE_SHELL_ID}`)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const visibleMs = prefersReducedMotion ? 600 : 3100
  const fadeMs = prefersReducedMotion ? 260 : 760

  window.setTimeout(() => {
    splash?.classList.add('splash-hide')
    siteShell?.classList.add('site-ready')

    window.setTimeout(() => {
      splash?.remove()
    }, fadeMs)
  }, visibleMs)
}
