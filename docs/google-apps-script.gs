const SHEET_ID = '1w9_MBPb6dUahn5l-IvAVId2K0RPkULT1XMTsXqDVuzI'
const NOTIFY_EMAIL = 'forta.2k25@gmail.com'

const SHEET_NAMES = {
  business: 'Business',
  recruit: 'Recruit',
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents)
  const formType = payload.formType === 'recruit' ? 'recruit' : 'business'
  const sheet = getSheet(formType)
  const submittedAt = payload.submittedAt || new Date().toLocaleString('ja-JP')

  if (formType === 'recruit') {
    sheet.appendRow([
      submittedAt,
      payload.inquiryId || '',
      payload.name || '',
      payload.kana || '',
      payload.instagram || '',
      payload.school || '',
      payload.grade || '',
      payload.interest || '',
      payload.strength || '',
      payload.weakness || '',
      payload.appeal || '',
    ])
  } else {
    sheet.appendRow([
      submittedAt,
      payload.inquiryId || '',
      payload.type || '',
      payload.name || '',
      payload.organization || '',
      payload.email || '',
      payload.timing || '',
      payload.budget || '',
      payload.message || '',
    ])
  }

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: createSubject(formType, payload),
    body: createBody(formType, payload, submittedAt),
  })

  if (formType === 'business' && isValidEmail(payload.email)) {
    sendContactAutoReply(payload)
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON)
}

function getSheet(formType) {
  const ss = SpreadsheetApp.openById(SHEET_ID)
  const sheetName = SHEET_NAMES[formType]
  let sheet = ss.getSheetByName(sheetName)

  if (!sheet) {
    sheet = ss.insertSheet(sheetName)
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(
      formType === 'recruit'
        ? ['受付日時', '受付ID', '氏名', '読み仮名', 'Instagram', '学校・学部・学科', '学年', '希望領域', '長所', '短所', 'アピールポイント']
        : ['受付日時', '受付ID', '問い合わせ種別', '名前', '会社名または所属', 'メールアドレス', '希望実施時期', '予算感', '相談内容']
    )
  }

  return sheet
}

function createSubject(formType, payload) {
  if (formType === 'recruit') {
    return `【青山ハック メンバー応募】${payload.name || ''} / ${payload.interest || ''}`
  }

  return `【青山ハック問い合わせ】${payload.type || ''} / ${payload.organization || ''}`
}

function createBody(formType, payload, submittedAt) {
  if (formType === 'recruit') {
    return `【青山ハック メンバー応募】
受付ID：${payload.inquiryId || ''}
受付日時：${submittedAt}

氏名：${payload.name || ''}
読み仮名：${payload.kana || ''}
Instagram：${payload.instagram || ''}
学校・学部・学科：${payload.school || ''}
学年：${payload.grade || ''}
希望領域：${payload.interest || ''}

長所：
${payload.strength || ''}

短所：
${payload.weakness || ''}

アピールポイント：
${payload.appeal || ''}`
  }

  return `【青山ハック お問い合わせ】
受付ID：${payload.inquiryId || ''}
受付日時：${submittedAt}

問い合わせ種別：${payload.type || ''}
名前：${payload.name || ''}
会社名または所属：${payload.organization || ''}
メールアドレス：${payload.email || ''}
希望実施時期：${payload.timing || ''}
予算感：${payload.budget || ''}

相談内容：
${payload.message || ''}`
}

function sendContactAutoReply(payload) {
  MailApp.sendEmail({
    to: payload.email,
    subject: 'この度は青山ハックへお問い合わせいただき、ありがとうございます。',
    body: createContactAutoReplyBody(payload),
    name: '青山ハック',
    replyTo: NOTIFY_EMAIL,
  })
}

function createContactAutoReplyBody(payload) {
  return `以下の内容でお問い合わせを受け付けました。
内容を確認のうえ、通常2〜3営業日以内にご連絡いたします。

【お問い合わせ種別】
${payload.type || ''}

【会社名・団体名】
${withHonorific(payload.organization)}

【お名前】
${withHonorific(payload.name)}

【お問い合わせ内容】
${payload.message || ''}

※本メールは自動送信です。
※内容にお心当たりがない場合は、お手数ですが本メールへご返信ください。

青山ハック
代表：米沢怜生
${NOTIFY_EMAIL}`
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function withHonorific(value) {
  return value ? `${value} 様` : ''
}
