// Seed data for multiple case matters, so the master dashboard has more
// than one case to show. Each case carries its own event timeline (see
// caseEvents.js for the stage numbering) and a list of upcoming key dates
// that feed the master calendar.
//
// case.intakeAnswers stays null until the claimant completes the intake
// questionnaire for that matter.

export const seedCases = [
  {
    id: 'cp-2026-0042',
    ref: 'CP-2026-0042',
    title: 'Renovation payment dispute',
    claimType: 'Contract for the provision of services',
    respondent: 'ABC Renovation Pte Ltd',
    amount: 4000,
    intakeAnswers: null,
    events: [
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
    ],
    upcomingDates: [],
  },
  {
    id: 'cp-2026-0091',
    ref: 'CP-2026-0091',
    title: 'Unrefunded motor vehicle deposit',
    claimType: 'Refund of motor vehicle deposit',
    respondent: 'Speedy Motors Pte Ltd',
    amount: 1500,
    intakeAnswers: {
      'mcq-1': 'Consectetur adipiscing elit',
      'mcq-2': 'Ut labore et dolore magna',
      'mcq-3': 'Sed do eiusmod tempor',
      'mcq-4': 'Lorem ipsum dolor sit amet',
      'mcq-5': 'Consectetur adipiscing elit',
      'open-1': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'open-2': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'open-3': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'open-4': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'open-5': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    },
    events: [
      { id: 'v2-1', date: '2026-07-02', stage: 0, type: 'system', title: 'Case file created', detail: 'Case file opened for a motor vehicle deposit refund claim.' },
      { id: 'v2-2', date: '2026-07-05', stage: 0, type: 'system', title: 'Eligibility screening passed', detail: 'Claim falls within the standard S$20,000 monetary limit and 2-year time bar.' },
      { id: 'v2-3', date: '2026-07-10', stage: 1, type: 'respondent', title: 'Respondent did not respond to negotiation', detail: 'No reply within the negotiation window on CJTS.' },
      { id: 'v2-4', date: '2026-07-18', stage: 2, type: 'user', title: 'Claim filed and lodgment fee paid', detail: 'Claim SCT/2026/00091 lodged with statement of claim and 4 labelled attachments.' },
      { id: 'v2-5', date: '2026-07-25', stage: 3, type: 'court', title: 'Correspondence received: Notice of service', detail: 'The State Courts confirmed the claim was served on the respondent.' },
      { id: 'v2-6', date: '2026-08-08', stage: 3, type: 'respondent', title: 'Response received', detail: 'The respondent disputes that the deposit is refundable.' },
      { id: 'v2-7', date: '2026-08-20', stage: 4, type: 'court', title: 'Correspondence received: Consultation notice', detail: 'Consultation before a Registrar fixed for 22 Sept 2026, 10:00am.' },
    ],
    upcomingDates: [
      { date: '2026-09-22', label: 'Consultation before Registrar, 10:00am', type: 'consultation' },
    ],
  },
  {
    id: 'cp-2026-0117',
    ref: 'CP-2026-0117',
    title: 'Defective goods refund claim',
    claimType: 'Contract for the sale of goods',
    respondent: 'TechGadget Store',
    amount: 850,
    intakeAnswers: {
      'mcq-1': 'Lorem ipsum dolor sit amet',
      'mcq-2': 'Sed do eiusmod tempor',
      'mcq-3': 'Ut labore et dolore magna',
      'mcq-4': 'Consectetur adipiscing elit',
      'mcq-5': 'Sed do eiusmod tempor',
      'open-1': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'open-2': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'open-3': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'open-4': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'open-5': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    },
    events: [
      { id: 'v3-1', date: '2026-06-01', stage: 0, type: 'system', title: 'Case file created', detail: 'Case file opened for a contract for the sale of goods.' },
      { id: 'v3-2', date: '2026-06-03', stage: 0, type: 'system', title: 'Eligibility screening passed', detail: 'Claim falls within the standard S$20,000 monetary limit and 2-year time bar.' },
      { id: 'v3-3', date: '2026-06-15', stage: 2, type: 'user', title: 'Claim filed and lodgment fee paid', detail: 'Claim SCT/2026/00117 lodged with statement of claim and 3 labelled attachments.' },
      { id: 'v3-4', date: '2026-06-25', stage: 3, type: 'court', title: 'Correspondence received: Notice of service', detail: 'The State Courts confirmed the claim was served on the respondent.' },
      { id: 'v3-5', date: '2026-07-10', stage: 3, type: 'respondent', title: 'Response and counterclaim received', detail: 'The respondent disputes the defect and has filed a counterclaim for S$200.' },
      { id: 'v3-6', date: '2026-07-30', stage: 4, type: 'court', title: 'Correspondence received: Consultation notice', detail: 'Consultation before a Registrar held on 20 Aug 2026.' },
      { id: 'v3-7', date: '2026-08-20', stage: 5, type: 'court', title: 'Correspondence received: Hearing notice', detail: 'Consultation did not resolve the matter. Hearing before a Referee fixed for 18 Sept 2026.' },
    ],
    upcomingDates: [
      { date: '2026-09-18', label: 'Hearing before Referee', type: 'hearing' },
    ],
  },
]
