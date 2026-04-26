import './style.css'
import { siteLayoutMarkup } from './components/SiteLayout'
import { splashMarkup, startSplashTransition } from './components/SplashScreen'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `${splashMarkup}${siteLayoutMarkup}`

startSplashTransition()

const revealElements = document.querySelectorAll<HTMLElement>('.reveal')
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible')
      }
    })
  },
  { threshold: 0.18 }
)
revealElements.forEach((element) => observer.observe(element))
