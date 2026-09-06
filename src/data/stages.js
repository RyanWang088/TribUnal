// The SCT process as the claimant walks it, stages 1-8. Each stage carries
// the copy shown in its popup: what the stage is, the checklist the claimant
// works through, and what follows once it is done.
//
// `dateKind` decides how the stage's date is framed:
//   'due' — a deadline, counted down as "X days left"
//   'on'  — an appointment, counted down as "X days away"
//   null  — the stage has no date of its own
//
// Stage 6 is `optional`: further directions are only given if the matter is
// not resolved at consultation, so it can be skipped straight to the hearing.

export const stages = [
  {
    id: 1,
    label: 'Pre-Filing Requirement',
    short: 'Pre-Filing',
    what: 'Check that your dispute can be brought to the Small Claims Tribunals before filing a claim.',
    tasks: [
      { id: 'eligibility', label: 'Complete the SCT eligibility check' },
      { id: 'assessment', label: 'Complete the CJTS Pre-Filing Assessment' },
      { id: 'accurate', label: 'Confirm the information provided is accurate' },
    ],
    dateKind: null,
    nextIntro: 'Once completed:',
    next: 'Continue to File Claim',
  },
  {
    id: 2,
    label: 'File Claim',
    short: 'File Claim',
    what: 'Submit your claim through CJTS to start your SCT case.',
    tasks: [
      { id: 'prepare', label: 'Prepare your claim details' },
      { id: 'upload', label: 'Upload supporting documents, if applicable' },
      { id: 'review', label: 'Review your claim' },
      { id: 'submit', label: 'Submit your claim on CJTS' },
      { id: 'confirm', label: 'Confirm claim has been filed' },
    ],
    dateKind: null,
    nextIntro: 'Once completed:',
    next: 'Serve Claim + Notice of Consultation',
  },
  {
    id: 3,
    label: 'Serve Claim + Notice of Consultation',
    short: 'Serve Claim',
    what: 'Make sure the other party receives the documents relating to your claim.',
    tasks: [
      { id: 'serve', label: 'Serve the claim and Notice of Consultation' },
      { id: 'confirm', label: 'Confirm the documents were served' },
      { id: 'record', label: 'Record the date of service' },
    ],
    dateKind: 'due',
    nextIntro: 'Once completed:',
    next: 'File Declaration of Service',
  },
  {
    id: 4,
    label: 'File Declaration of Service',
    short: 'Declaration of Service',
    what: 'Confirm to the Tribunal that you have served the required documents.',
    tasks: [
      { id: 'complete', label: 'Complete the Declaration of Service' },
      { id: 'file', label: 'File it on CJTS' },
      { id: 'confirm', label: 'Confirm submission' },
    ],
    dateKind: 'due',
    nextIntro: 'Once completed:',
    next: 'Consultation',
  },
  {
    id: 5,
    label: 'Consultation',
    short: 'Consultation',
    what: 'A session where the Tribunal helps parties understand the dispute and consider how it may proceed.',
    tasks: [
      { id: 'check-date', label: 'Check your consultation date' },
      { id: 'prepare', label: 'Prepare your relevant documents' },
      { id: 'attend', label: 'Attend the consultation' },
    ],
    dateKind: 'on',
    nextIntro: 'Once completed:',
    next: 'Further Directions / Hearing',
  },
  {
    id: 6,
    label: 'Further Directions',
    short: 'Further Directions',
    optional: true,
    what: 'The Tribunal may give you additional instructions about what you need to do next.',
    tasks: [
      { id: 'read', label: 'Read any directions issued by the Tribunal' },
      { id: 'complete', label: 'Complete any required action' },
      { id: 'confirm', label: 'Confirm completion' },
    ],
    dateKind: 'due',
    dateOptional: true,
    skipLabel: 'No directions were issued — skip to Hearing',
    nextIntro: 'If no directions are issued:',
    next: 'Hearing',
  },
  {
    id: 7,
    label: 'Hearing',
    short: 'Hearing',
    what: 'The Tribunal considers the dispute and the information provided by the parties.',
    tasks: [
      { id: 'check-date', label: 'Check your hearing date and time' },
      { id: 'prepare-docs', label: 'Prepare your documents and evidence' },
      { id: 'prepare-points', label: 'Prepare your points for the hearing' },
      { id: 'attend', label: 'Attend the hearing' },
    ],
    dateKind: 'on',
    nextIntro: 'Once completed:',
    next: 'Tribunal Order',
  },
  {
    id: 8,
    label: 'Tribunal Order',
    short: 'Tribunal Order',
    what: 'The Tribunal gives its decision/order on the dispute.',
    tasks: [
      { id: 'check-order', label: 'Check the Tribunal Order' },
      { id: 'read', label: 'Read any instructions or deadlines' },
      { id: 'next-steps', label: 'Take any required next steps' },
    ],
    dateKind: null,
    nextIntro: null,
    next: null,
  },
]

export const FIRST_STAGE = stages[0].id
export const LAST_STAGE = stages[stages.length - 1].id

// Stage ids start at 1, so they are not array indices — always look up by id.
export function stageById(id) {
  return stages.find((s) => s.id === Number(id)) ?? null
}

// A stage is done when every checkbox is ticked, or when an optional stage
// has been explicitly skipped.
export function isStageComplete(stageProgress, stageId) {
  const stage = stageById(stageId)
  if (!stage) return false
  const done = stageProgress?.[stageId]
  if (!done) return false
  if (done.skipped) return true
  return stage.tasks.every((t) => done[t.id])
}

export function stageTasksDone(stageProgress, stageId) {
  const stage = stageById(stageId)
  if (!stage) return 0
  const done = stageProgress?.[stageId] ?? {}
  return stage.tasks.filter((t) => done[t.id]).length
}

// Whole days from today to `iso`. Negative once the date has passed.
export function daysUntil(iso) {
  if (!iso) return null
  const target = new Date(iso + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

// The countdown line under a stage's date, phrased for a deadline or for an
// appointment depending on the stage's dateKind.
export function countdownLabel(dateKind, iso) {
  const days = daysUntil(iso)
  if (days === null) return null
  const plural = (n) => `${n} day${n === 1 ? '' : 's'}`
  if (dateKind === 'due') {
    if (days > 0) return `⏳ ${plural(days)} left`
    if (days === 0) return '⏳ Due today'
    return `⚠ ${plural(-days)} overdue`
  }
  if (days > 0) return `📅 ${plural(days)} away`
  if (days === 0) return '📅 Today'
  return `📅 ${plural(-days)} ago`
}
