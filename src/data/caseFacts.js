import { openQuestions } from './questions.js'
import { eligibilityQuestions } from './eligibility.js'
import { stages } from './caseEvents.js'

const WHO = { user: 'Claimant', court: 'Court', respondent: 'Respondent', system: 'TribUnal' }

// Resolves the stored eligibility answers (option letters) back to the
// option text the claimant actually saw, so the model never has to guess
// what "b" meant.
function readableEligibility(eligibility) {
  if (!eligibility) return null
  const out = {}
  for (const q of eligibilityQuestions) {
    const value = eligibility[q.id]
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue
    if (q.type === 'radio') {
      out[q.text] = q.options.find((o) => o.value === value)?.label ?? value
    } else if (q.type === 'checkbox') {
      out[q.text] = value.map((v) => q.options.find((o) => o.value === v)?.label ?? v)
    } else {
      out[q.text] = value
    }
  }
  return out
}

// Everything the claimant has entered about this case, in plain language.
// Nothing here is generated — it is the ground truth the model is asked to
// summarise and must not go beyond.
export function buildCaseFacts(caseData) {
  const { ref, title, claimType, respondent, amount, eligibility, intakeAnswers, events } = caseData

  const answers = {}
  const evidence = {}
  if (intakeAnswers) {
    for (const q of openQuestions) {
      if (intakeAnswers[q.id] !== undefined) answers[q.text] = intakeAnswers[q.id]
      const files = intakeAnswers.files?.[q.id]
      if (files?.length) evidence[q.text] = files
    }
  }

  return {
    caseRef: ref,
    title,
    claimType,
    respondent,
    amountClaimed: amount,
    eligibilityAnswers: readableEligibility(eligibility),
    intakeAnswers: intakeAnswers ? answers : null,
    evidenceUploaded: Object.keys(evidence).length ? evidence : null,
    timeline: (events ?? []).map((ev) => ({
      date: ev.date,
      stage: `${ev.stage} · ${stages[ev.stage]?.label ?? 'Unknown'}`,
      from: WHO[ev.type] ?? ev.type,
      title: ev.title,
      detail: ev.detail,
    })),
  }
}
