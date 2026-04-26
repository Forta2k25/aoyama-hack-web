export const SPLASH_ID = 'splash-screen'
export const SITE_SHELL_ID = 'site-content'

const PARTICLE_COUNT = 10

const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (360 / PARTICLE_COUNT) * i
  return `<span class="splash-particle" style="--angle:${angle}deg;--delay:${(i % 5) * 0.18}s"></span>`
}).join('')

export const splashMarkup = `
  <div id="${SPLASH_ID}" class="splash-screen" aria-label="Aoyama Hack splash">
    <div class="splash-background"></div>
    <div class="splash-glow"></div>
    <div class="splash-rings">
      <div class="splash-ripple splash-ripple-1"></div>
      <div class="splash-ripple splash-ripple-2"></div>
      <div class="splash-ripple splash-ripple-3"></div>
    </div>
    <div class="splash-particles" aria-hidden="true">${particles}</div>
    <div class="splash-final-bloom"></div>
    <h1 class="splash-title">青山ハック</h1>
  </div>
`

export const startSplashTransition = () => {
  const splash = document.querySelector<HTMLElement>(`#${SPLASH_ID}`)
  const siteShell = document.querySelector<HTMLElement>(`#${SITE_SHELL_ID}`)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const visibleMs = prefersReducedMotion ? 520 : 3700
  const fadeMs = prefersReducedMotion ? 220 : 520

  window.setTimeout(() => {
    splash?.classList.add('splash-fade-out')
    siteShell?.classList.add('content-ready')

    window.setTimeout(() => {
      splash?.remove()
    }, fadeMs)
  }, visibleMs)
}
