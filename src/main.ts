import './style.css'
import { getSiteLayoutMarkup } from './components/SiteLayout'
import { SITE_SHELL_ID, splashMarkup, startSplashTransition } from './components/SplashScreen'

const pathname = window.location.pathname
const shouldShowSplash = pathname === '/'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `${shouldShowSplash ? splashMarkup : ''}${getSiteLayoutMarkup(pathname)}`

if (shouldShowSplash) {
  startSplashTransition()
} else {
  document.querySelector<HTMLElement>(`#${SITE_SHELL_ID}`)?.classList.add('content-ready')
}

const revealElements = document.querySelectorAll<HTMLElement>('.reveal')
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible')
      }
    })
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.01 }
)
revealElements.forEach((element) => observer.observe(element))

const menuToggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]')
const menuClose = document.querySelector<HTMLButtonElement>('[data-menu-close]')
const menuPanel = document.querySelector<HTMLElement>('[data-menu-panel]')

const setMenuOpen = (isOpen: boolean) => {
  menuToggle?.setAttribute('aria-expanded', String(isOpen))
  menuPanel?.setAttribute('aria-hidden', String(!isOpen))
  document.body.classList.toggle('menu-open', isOpen)
}

menuToggle?.addEventListener('click', () => setMenuOpen(true))
menuClose?.addEventListener('click', () => setMenuOpen(false))
menuPanel?.addEventListener('click', (event) => {
  if (event.target === menuPanel) {
    setMenuOpen(false)
  }
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setMenuOpen(false)
  }
})

const CONTACT_EMAIL = 'forta.2k25@gmail.com'
const FORM_ENDPOINTS = {
  business: 'https://script.google.com/macros/s/AKfycbykxAovNPCK0L_MHTccWPT5oL4FFQrerizULA6w-mNGeFqAQiw7oJltkcmq7DLj1OuG/exec',
  recruit: 'https://script.google.com/macros/s/AKfycbykxAovNPCK0L_MHTccWPT5oL4FFQrerizULA6w-mNGeFqAQiw7oJltkcmq7DLj1OuG/exec',
}

const getFieldValue = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim()
const hasHoneypotValue = (formData: FormData) => getFieldValue(formData, 'website') !== ''

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char]
  })

const formatSubmittedAt = () =>
  new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

const contactForm = document.querySelector<HTMLFormElement>('[data-contact-form]')
const contactConfirmation = document.querySelector<HTMLElement>('[data-contact-confirmation]')
const contactSummary = document.querySelector<HTMLElement>('[data-contact-summary]')
const contactMailto = document.querySelector<HTMLAnchorElement>('[data-contact-mailto]')
const contactEdit = document.querySelector<HTMLButtonElement>('[data-contact-edit]')
const contactError = document.querySelector<HTMLElement>('[data-contact-error]')
let latestContactPayload: Record<string, string> | null = null

const postToEndpoint = async (formType: keyof typeof FORM_ENDPOINTS, payload: Record<string, string>) => {
  const endpoint = FORM_ENDPOINTS[formType]

  if (!endpoint) return false

  await fetch(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ formType, ...payload }),
  })

  return true
}

const resetSubmissionFlow = (
  form: HTMLFormElement | null,
  confirmation: HTMLElement | null,
  summary: HTMLElement | null,
  submitLink: HTMLAnchorElement | null,
  submitText: string,
  error: HTMLElement | null
) => {
  form?.reset()
  if (summary) summary.innerHTML = ''
  if (error) error.textContent = ''
  if (submitLink) {
    submitLink.textContent = submitText
    submitLink.href = '#'
    submitLink.removeAttribute('aria-disabled')
  }
  if (confirmation) confirmation.hidden = true
  if (form) {
    form.hidden = false
    form.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const buildContactBody = (data: Record<string, string>, submittedAt: string, inquiryId: string) => `【青山ハック お問い合わせ】
受付ID：${inquiryId}
受付日時：${submittedAt}

【問い合わせ概要】
問い合わせ種別：${data.type}
名前：${data.name}
会社名または所属：${data.organization}
メールアドレス：${data.email}
希望実施時期：${data.timing || '未入力'}
予算感：${data.budget || '未入力'}

【相談内容】
${data.message}
`

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault()
  contactError!.textContent = ''

  if (contactForm.hidden) return

  if (!contactForm.reportValidity()) {
    contactError!.textContent = '必須項目を入力してください。'
    return
  }

  const formData = new FormData(contactForm)
  if (hasHoneypotValue(formData)) {
    contactError!.textContent = ''
    return
  }

  const data = {
    name: getFieldValue(formData, 'name'),
    organization: getFieldValue(formData, 'organization'),
    email: getFieldValue(formData, 'email'),
    type: getFieldValue(formData, 'type'),
    message: getFieldValue(formData, 'message'),
    timing: getFieldValue(formData, 'timing'),
    budget: getFieldValue(formData, 'budget'),
  }
  const submittedAt = formatSubmittedAt()
  const inquiryId = `AH-${Date.now().toString(36).toUpperCase()}`
  const summaryItems = [
    ['受付ID', inquiryId],
    ['問い合わせ種別', data.type],
    ['名前', data.name],
    ['会社名または所属', data.organization],
    ['メールアドレス', data.email],
    ['希望実施時期', data.timing || '未入力'],
    ['予算感', data.budget || '未入力'],
    ['相談内容', data.message],
  ]

  if (contactSummary) {
    contactSummary.innerHTML = summaryItems
      .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
      .join('')
  }

  const subject = `【青山ハック問い合わせ】${data.type} / ${data.organization}`
  const body = buildContactBody(data, submittedAt, inquiryId)
  latestContactPayload = { ...data, submittedAt, inquiryId }

  if (contactMailto) {
    contactMailto.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  contactForm.hidden = true
  contactConfirmation!.hidden = false
  contactConfirmation?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

contactEdit?.addEventListener('click', () => {
  contactConfirmation!.hidden = true
  contactForm!.hidden = false
  contactForm?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

contactMailto?.addEventListener('click', async (event) => {
  if (!latestContactPayload || !FORM_ENDPOINTS.business) return

  event.preventDefault()
  if (contactMailto.getAttribute('aria-disabled') === 'true') return

  contactMailto.textContent = '送信中...'
  contactMailto.setAttribute('aria-disabled', 'true')

  try {
    await postToEndpoint('business', latestContactPayload)
    window.alert('お問い合わせの送信が完了しました。内容を確認し、通常2〜3営業日以内に返信いたします。')
    latestContactPayload = null
    resetSubmissionFlow(
      contactForm,
      contactConfirmation,
      contactSummary,
      contactMailto,
      '最終確認して送信する',
      contactError
    )
  } catch {
    window.alert('送信に失敗しました。時間を置いてもう一度お試しください。')
    contactMailto.textContent = '最終確認して送信する'
    contactMailto.removeAttribute('aria-disabled')
  }
})

const recruitForm = document.querySelector<HTMLFormElement>('[data-recruit-form]')
const recruitConfirmation = document.querySelector<HTMLElement>('[data-recruit-confirmation]')
const recruitSummary = document.querySelector<HTMLElement>('[data-recruit-summary]')
const recruitMailto = document.querySelector<HTMLAnchorElement>('[data-recruit-mailto]')
const recruitEdit = document.querySelector<HTMLButtonElement>('[data-recruit-edit]')
const recruitError = document.querySelector<HTMLElement>('[data-recruit-error]')
let latestRecruitPayload: Record<string, string> | null = null

const buildRecruitBody = (data: Record<string, string>, submittedAt: string, inquiryId: string) => `【青山ハック メンバー応募】
受付ID：${inquiryId}
受付日時：${submittedAt}

【応募者情報】
氏名：${data.name}
読み仮名：${data.kana}
Instagram：${data.instagram}
学校・学部・学科：${data.school}
学年：${data.grade}
取り組みたいこと：${data.interest}

【本人記入】
長所：
${data.strength}

短所：
${data.weakness}

アピールポイント：
${data.appeal}
`

recruitForm?.addEventListener('submit', (event) => {
  event.preventDefault()
  recruitError!.textContent = ''

  if (recruitForm.hidden) return

  if (!recruitForm.reportValidity()) {
    recruitError!.textContent = '必須項目を入力してください。'
    return
  }

  const formData = new FormData(recruitForm)
  if (hasHoneypotValue(formData)) {
    recruitError!.textContent = ''
    return
  }

  const data = {
    name: getFieldValue(formData, 'name'),
    kana: getFieldValue(formData, 'kana'),
    instagram: getFieldValue(formData, 'instagram'),
    school: getFieldValue(formData, 'school'),
    grade: getFieldValue(formData, 'grade'),
    interest: getFieldValue(formData, 'interest'),
    strength: getFieldValue(formData, 'strength'),
    weakness: getFieldValue(formData, 'weakness'),
    appeal: getFieldValue(formData, 'appeal'),
  }
  const submittedAt = formatSubmittedAt()
  const inquiryId = `AH-R-${Date.now().toString(36).toUpperCase()}`
  const summaryItems = [
    ['受付ID', inquiryId],
    ['氏名', data.name],
    ['読み仮名', data.kana],
    ['Instagram', data.instagram],
    ['学校・学部・学科', data.school],
    ['学年', data.grade],
    ['取り組みたいこと', data.interest],
    ['長所', data.strength],
    ['短所', data.weakness],
    ['アピールポイント', data.appeal],
  ]

  if (recruitSummary) {
    recruitSummary.innerHTML = summaryItems
      .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
      .join('')
  }

  const subject = `【青山ハック メンバー応募】${data.name} / ${data.interest}`
  const body = buildRecruitBody(data, submittedAt, inquiryId)
  latestRecruitPayload = { ...data, submittedAt, inquiryId }

  if (recruitMailto) {
    recruitMailto.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  recruitForm.hidden = true
  recruitConfirmation!.hidden = false
  recruitConfirmation?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

recruitEdit?.addEventListener('click', () => {
  recruitConfirmation!.hidden = true
  recruitForm!.hidden = false
  recruitForm?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

recruitMailto?.addEventListener('click', async (event) => {
  if (!latestRecruitPayload || !FORM_ENDPOINTS.recruit) return

  event.preventDefault()
  if (recruitMailto.getAttribute('aria-disabled') === 'true') return

  recruitMailto.textContent = '送信中...'
  recruitMailto.setAttribute('aria-disabled', 'true')

  try {
    await postToEndpoint('recruit', latestRecruitPayload)
    window.alert('メンバー応募が完了しました。内容を確認し、通常2〜3営業日以内に連絡いたします。')
    latestRecruitPayload = null
    resetSubmissionFlow(
      recruitForm,
      recruitConfirmation,
      recruitSummary,
      recruitMailto,
      '最終確認して応募する',
      recruitError
    )
  } catch {
    window.alert('送信に失敗しました。時間を置いてもう一度お試しください。')
    recruitMailto.textContent = '最終確認して応募する'
    recruitMailto.removeAttribute('aria-disabled')
  }
})
