// Seed events for the case timeline. Each event belongs to an SCT stage
// (0 = forum check, 1 = pre-filing negotiation, 2 = filing, 3 = service and
// response, 4 = consultation, 5 = hearing, 6 = order and enforcement).
// `type` controls the icon and colour: user | court | respondent | system

export const stages = [
  { id: 0, label: 'Forum check' },
  { id: 1, label: 'Pre-filing negotiation' },
  { id: 2, label: 'Filing on CJTS' },
  { id: 3, label: 'Service & response' },
  { id: 4, label: 'Consultation' },
  { id: 5, label: 'Hearing' },
  { id: 6, label: 'Order & enforcement' },
]

// Where the case has reached. Stage 0 (forum check) is complete for every
// case that exists: a case file is only opened once the eligibility
// questionnaire has passed, so no live case sits at stage 0.
export function currentStageOf(events) {
  return Math.max(events.reduce((max, ev) => Math.max(max, ev.stage), 0), 1)
}

export const initialEvents = [
  {
    id: 'seed-1',
    date: '2026-08-20',
    stage: 0,
    type: 'system',
    title: 'Case file created',
    detail: 'TribUnal opened a new case file for a contract for the provision of services.',
  },
  {
    id: 'seed-2',
    date: '2026-08-22',
    stage: 0,
    type: 'system',
    title: 'Eligibility screening passed',
    detail:
      'Claim type, monetary limit (S$20,000) and 2-year limitation period checked against official SCT sources.',
  },
  {
    id: 'seed-3',
    date: '2026-08-28',
    stage: 1,
    type: 'user',
    title: 'Pre-filing negotiation started on CJTS',
    detail: 'Invitation sent to the respondent through the CJTS online negotiation facility.',
  },
]

// Scenarios used by the "Simulate case update" panel on the dashboard.
// In production these would arrive from CJTS / court correspondence.
export const simulatedUpdates = [
  {
    key: 'nego-fail',
    label: 'Respondent declines negotiation',
    event: {
      stage: 1,
      type: 'respondent',
      title: 'Respondent did not respond to negotiation',
      detail: 'No reply within the negotiation window. You may proceed to file a claim.',
    },
  },
  {
    key: 'filed',
    label: 'Claim filed on CJTS',
    event: {
      stage: 2,
      type: 'user',
      title: 'Claim filed and lodgment fee paid',
      detail: 'Claim SCT/2026/01234 lodged. Statement of claim and 6 labelled attachments uploaded.',
    },
  },
  {
    key: 'served',
    label: 'Court confirms service',
    event: {
      stage: 3,
      type: 'court',
      title: 'Correspondence received: Notice of service',
      detail: 'The State Courts confirmed the claim was served on the respondent at the ACRA-registered address.',
    },
  },
  {
    key: 'response',
    label: 'Respondent files Response',
    event: {
      stage: 3,
      type: 'respondent',
      title: 'Response and counterclaim received',
      detail: 'The respondent disputes the completion date and has filed a counterclaim for S$1,200.',
    },
  },
  {
    key: 'consult',
    label: 'Consultation date fixed',
    event: {
      stage: 4,
      type: 'court',
      title: 'Correspondence received: Consultation notice',
      detail: 'Consultation before a Registrar fixed for 14 Oct 2026, 9:30am. Attendance is mandatory.',
    },
  },
  {
    key: 'hearing',
    label: 'Matter set down for hearing',
    event: {
      stage: 5,
      type: 'court',
      title: 'Correspondence received: Hearing notice',
      detail: 'Consultation did not resolve the matter. Hearing before a Referee fixed for 2 Nov 2026.',
    },
  },
  {
    key: 'order',
    label: 'Order made by Referee',
    event: {
      stage: 6,
      type: 'court',
      title: 'Order of Tribunal issued',
      detail: 'Order made in your favour for S$3,400. Enforcement is a separate process in the State Courts.',
    },
  },
]
