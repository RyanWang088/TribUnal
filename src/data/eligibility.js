// SCT eligibility screen (Singapore). Each option carries a status:
//   ok   — eligible on this point
//   warn — eligible, but with a condition the claimant must satisfy
//   fail — the SCT cannot hear the claim
// Free-text questions (amount, date) are evaluated in evaluateEligibility.

export const eligibilityQuestions = [
  {
    id: 'amount',
    type: 'text',
    text: 'How much are you claiming, in SGD?',
    placeholder: 'e.g. 4500',
    ref: 'SCTA 1984 s 5(3)(a), s 5(4), s 9; cf. s 8',
  },
  {
    id: 'date',
    type: 'date',
    text: 'On what date did the problem happen?',
    hint: 'The date of purchase, non-delivery, non-payment or damage.',
    placeholder: 'Select a date',
    ref: 's 5(3)(b)',
  },
  {
    id: 'subject',
    type: 'radio',
    text: 'What is the dispute about?',
    ref: 's 5(1) + Schedule (Act 33/2018)',
    options: [
      { value: 'a', label: 'Something you bought (goods)', status: 'ok' },
      { value: 'b', label: 'A service someone was paid to do', status: 'ok' },
      { value: 'c', label: 'Renting a home, lease of 2 years or less', status: 'ok' },
      { value: 'd', label: 'Someone damaged your property', status: 'ok' },
      {
        value: 'e',
        label: 'A shop or supplier misled or pressured you',
        status: 'ok',
        note: 'CPFTA 2003 ss 4, 7 + Second Schedule',
      },
      {
        value: 'f',
        label: "A car dealer won't refund your deposit",
        status: 'ok',
        note: 'CPFTA (Motor Vehicle Dealer Deposits) Regulations',
      },
      {
        value: 'g',
        label:
          'A government body or management corporation is claiming charges from you (Town Council / HDB / MCST)',
        status: 'ok',
        note: 'Residual "other statutory claims under written law" limb',
      },
      { value: 'h', label: 'None of the above', status: 'fail' },
    ],
  },
  {
    id: 'party',
    type: 'radio',
    text: 'Where is the other party based?',
    ref: 's 19; State Courts guidance',
    options: [
      { value: 'a', label: 'An individual living in Singapore', status: 'ok' },
      { value: 'b', label: 'A business with a Singapore address or UEN', status: 'ok' },
      { value: 'c', label: 'Only an overseas address or overseas seller', status: 'fail' },
      {
        value: 'd',
        label: 'You have no address for them',
        status: 'warn',
        note: 'You need an address for the other party before you can file.',
      },
    ],
  },
  {
    id: 'exclusions',
    type: 'checkbox',
    text: 'Tick any that apply.',
    noneValue: 'i',
    options: [
      { value: 'a', label: 'The damage involved a vehicle accident', status: 'fail', note: 's 5(2)(a)' },
      {
        value: 'b',
        label: 'The other party is your neighbour',
        status: 'fail',
        note: 'Goes to the CDRT — CDRA 2015 s 4',
      },
      {
        value: 'c',
        label: "It's about a job, salary or your employer",
        status: 'fail',
        note: 'Goes to the ECT — Employment Claims Act 2016; cf. s 5(2)(b)',
      },
      {
        value: 'd',
        label:
          'The rental is an office, shop or factory, or you only had permission to use the space rather than a lease',
        status: 'fail',
        note: 'Schedule',
      },
      { value: 'e', label: 'The rental term is longer than 2 years', status: 'fail', note: 'Schedule' },
      {
        value: 'f',
        label: 'You or the other party is a bankrupt',
        status: 'warn',
        note: "You will need the Official Assignee's permission — IRDA 2018",
      },
      {
        value: 'g',
        label: 'You are claiming as a company being wound up',
        status: 'warn',
        note: "You will need the Official Receiver's or liquidator's permission",
      },
      {
        value: 'h',
        label: "The company you're claiming against is being wound up",
        status: 'warn',
        note: "You will need the High Court's permission",
      },
      { value: 'i', label: 'None of the above', status: 'ok' },
    ],
  },
  {
    id: 'remedy',
    type: 'radio',
    text: 'What do you want the tribunal to order?',
    ref: 's 31; verify numbering in the 2020 Rev Ed',
    options: [
      { value: 'a', label: 'The other side to pay you money', status: 'ok' },
      { value: 'b', label: 'The other side to fix, redo or complete the work', status: 'ok' },
      { value: 'c', label: 'Both', status: 'ok' },
      {
        value: 'd',
        label: 'Something else (stop them doing something, a formal declaration)',
        status: 'fail',
        note: 'Wrong forum',
      },
    ],
  },
]

export function parseAmount(text) {
  const cleaned = String(text ?? '').replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// Accepts dd/mm/yyyy (also with - or .) first, since that is how dates
// are written in Singapore; otherwise falls back to native parsing.
export function parseDate(text) {
  const s = String(text ?? '').trim()
  if (!s) return null
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  let d
  if (dmy) {
    d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    if (d.getDate() !== Number(dmy[1])) return null
  } else {
    d = new Date(s)
  }
  return Number.isNaN(d.getTime()) ? null : d
}

const AMOUNT_LIMIT = 20000
const AMOUNT_CONSENT_LIMIT = 30000

// Returns { status: 'ok' | 'warn' | 'fail' | null, note } per question.
// null means the question is unanswered or the value cannot be read.
export function evaluateEligibility(answers) {
  const result = {}

  const amount = parseAmount(answers.amount)
  if (amount === null) result.amount = { status: null }
  else if (amount <= AMOUNT_LIMIT) result.amount = { status: 'ok', note: 'Within the SCT limit.' }
  else if (amount <= AMOUNT_CONSENT_LIMIT)
    result.amount = {
      status: 'warn',
      note: 'Claims between $20,001 and $30,000 need a Memorandum of Consent signed by both parties.',
    }
  else
    result.amount = {
      status: 'fail',
      note: 'Claims above $30,000 are outside the SCT limit unless you abandon the excess.',
    }

  const date = parseDate(answers.date)
  if (!date) result.date = { status: null }
  else {
    const today = new Date()
    const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate())
    if (date > today) result.date = { status: null }
    else if (date >= twoYearsAgo) result.date = { status: 'ok', note: 'Within the 2-year limit.' }
    else result.date = { status: 'fail', note: 'The SCT can only hear claims brought within 2 years.' }
  }

  for (const q of eligibilityQuestions) {
    if (q.type === 'radio') {
      const opt = q.options.find((o) => o.value === answers[q.id])
      result[q.id] = opt ? { status: opt.status, note: opt.note } : { status: null }
    } else if (q.type === 'checkbox') {
      const picked = q.options.filter((o) => (answers[q.id] ?? []).includes(o.value))
      if (picked.length === 0) result[q.id] = { status: null }
      else if (picked.some((o) => o.status === 'fail')) result[q.id] = { status: 'fail' }
      else if (picked.some((o) => o.status === 'warn')) result[q.id] = { status: 'warn' }
      else result[q.id] = { status: 'ok' }
    }
  }

  const statuses = Object.values(result).map((r) => r.status)
  return {
    perQuestion: result,
    complete: statuses.every((s) => s !== null),
    failed: statuses.includes('fail'),
    amount,
  }
}
