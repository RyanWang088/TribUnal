// Seed data for multiple case matters, so the master dashboard has more
// than one case to show. Each case carries its own event timeline (see
// caseEvents.js for the stage numbering) and a list of upcoming key dates
// that feed the master calendar.
//
// case.intakeAnswers stays null until the claimant completes the intake
// questionnaire for that matter.

// Bump this whenever the seed data below is edited. On the next page load
// CaseContext swaps the stored copies of these demo cases for the new ones,
// so the seeds do not have to be cleared from localStorage by hand. Cases
// created through the app are left untouched.
export const SEED_VERSION = 3

export const seedCases = [
  {
    id: 'cp-2026-0042',
    ref: 'CP-2026-0042',
    title: 'Renovation payment dispute',
    claimType: 'Contract for the provision of services',
    respondent: 'ABC Renovation Pte Ltd',
    amount: 4000,
    // Eligibility answers are stored as the option values from
    // eligibility.js; caseFacts.readableEligibility maps them back to the
    // labels the claimant saw.
    eligibility: {
      amount: '4000',
      date: '2026-05-12',
      subject: 'b',
      party: 'b',
      exclusions: ['i'],
      remedy: 'a',
    },
    intakeAnswers: {
      'open-1':
        'I paid ABC Renovation Pte Ltd S$8,000 to renovate my kitchen and both bathrooms. The work was supposed to be finished by 30 April 2026. They stopped work on 12 May 2026 with the kitchen cabinets and the master bathroom waterproofing incomplete, and have not returned since.',
      'open-2':
        'Purely a commercial one. I found them through a renovation listing site in February 2026 and signed their standard quotation and works schedule on 3 March 2026. I had no dealings with them before that.',
      'open-3':
        'Work started on 16 March 2026. Progress was slow from the start. I paid a 50% deposit of S$4,000 on signing and a further S$4,000 on 20 April 2026 when they said the carpentry was ready for installation. On 12 May 2026 the workers packed up and left mid-job. I called and messaged the project manager on 13, 15 and 19 May 2026. He replied once saying they were short-handed and would return the following week, then stopped responding.',
      'open-4':
        'I say they were paid S$8,000 for a job they did not finish, and that roughly half the work is still outstanding. They have not disputed that the work is incomplete — they simply stopped replying. I accept that some of the delay in March was caused by my own change to the countertop material.',
      'open-5':
        'I want S$4,000 back. That is the second progress payment I made on 20 April 2026 for carpentry and waterproofing that was never completed. I am not claiming for the portion of the work that was actually done.',
      'open-6':
        'The signed quotation and works schedule dated 3 March 2026, both payment receipts, the WhatsApp thread with the project manager from March to May 2026, and photographs of the unfinished kitchen and master bathroom taken on 14 May 2026.',
      'open-7':
        'I sent a written demand to their registered address on 2 June 2026 asking them to either return to complete the work or refund S$4,000 within 14 days. There was no reply. I also left a message at their office number on 18 June 2026.',
      'open-8':
        'I am not sure whether the quotation counts as a proper contract, since it is only two pages and does not mention what happens if they abandon the job. I am also unsure whether I should be claiming the cost of hiring someone else to finish the work instead of a refund.',
      'open-9':
        'The company is still trading — their listing is active and they are taking on new jobs. I have not engaged another contractor yet because I did not want to disturb the site before this is resolved.',
      'open-10':
        'That they will ignore the tribunal the way they have ignored me, and that even if I win I will not actually see the money.',
    },
    // Stage checklists. Keyed by stage id (see stages.js), then task id.
    stageProgress: {
      1: { eligibility: true, accurate: true },
    },
    stageDates: {},
    events: [
      {
        id: 'seed-1',
        date: '2026-08-20',
        stage: 1,
        type: 'system',
        title: 'Case file created',
        detail: 'TribUnal opened a new case file for a contract for the provision of services.',
      },
      {
        id: 'seed-2',
        date: '2026-08-22',
        stage: 1,
        type: 'system',
        title: 'Eligibility screening passed',
        detail:
          'Claim type, monetary limit (S$20,000) and 2-year limitation period checked against official SCT sources.',
      },
      {
        id: 'seed-intake',
        date: '2026-08-22',
        stage: 1,
        type: 'user',
        title: 'Intake questionnaire completed',
        detail: 'Your answers have been saved to your case file.',
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
    eligibility: {
      amount: '1500',
      date: '2026-06-05',
      subject: 'f',
      party: 'b',
      exclusions: ['i'],
      remedy: 'a',
    },
    intakeAnswers: {
      'open-1':
        'I placed a S$1,500 booking deposit on a used Honda Civic with Speedy Motors Pte Ltd on 5 June 2026. My hire purchase application was declined, so the sale could not go through. I asked for the deposit back on 20 June 2026 and they refused.',
      'open-2':
        'None outside this transaction. I walked into their showroom at Ubi on 5 June 2026 after seeing the car listed online. I had never bought from them before and do not know anyone there personally.',
      'open-3':
        'On 5 June 2026 I test drove the car and signed their booking form the same afternoon, paying S$1,500 by PayNow. The salesman said the deposit secured the car while my hire purchase was arranged and that delivery would be about three weeks. On 18 June 2026 the finance company declined my application. I told the salesman the next morning and asked to cancel. On 20 June 2026 the sales manager told me over the phone that all deposits are non-refundable and pointed to a line at the bottom of the booking form. I asked for that in writing and received a one-line email on 23 June 2026 saying the same thing. When I called again on 1 July 2026 they said the car had already been sold to another buyer.',
      'open-4':
        'My position is that the sale never happened, they have since sold the car to someone else, and they are keeping S$1,500 for nothing. They say the deposit was forfeited the moment I signed the booking form. I accept that the booking form does contain a line about deposits being non-refundable, I did sign it, and I did not read that line carefully at the time.',
      'open-5':
        'The return of the full S$1,500 deposit. I am not claiming anything on top of that, and I am not asking for the car.',
      'open-6':
        'The signed booking form dated 5 June 2026, the PayNow transaction record for S$1,500, the hire purchase rejection letter dated 18 June 2026, the sales manager’s email of 23 June 2026 refusing the refund, and the original online listing for the car.',
      'open-7':
        'I called and emailed the dealer several times between 19 June and 1 July 2026. I also started a negotiation through the CJTS online facility on 10 July 2026, but they never responded to it. I have not lodged a complaint with CASE.',
      'open-8':
        'I have read that there is a limit on how much a motor vehicle dealer is allowed to collect as a deposit, but I do not know whether that applies to a booking deposit like mine, or what happens if the dealer took more than the limit. I am also unsure whether it makes a difference that the finance rejection was not my fault.',
      'open-9':
        'The car was relisted on their website on about 25 June 2026 and I have a screenshot of it. That is roughly a week after I asked to cancel, so I do not think they lost a sale because of me.',
      'open-10':
        'That the signed booking form will be treated as the end of the matter and the non-refundable line will decide everything, even though the sale never completed.',
    },
    stageProgress: {
      1: { eligibility: true, assessment: true, accurate: true },
      2: { prepare: true, upload: true, review: true, submit: true, confirm: true },
      3: { serve: true, confirm: true, record: true },
      4: { complete: true, file: true, confirm: true },
      5: { 'check-date': true },
    },
    stageDates: { 3: '2026-07-25', 4: '2026-08-01', 5: '2026-09-22' },
    events: [
      { id: 'v2-1', date: '2026-07-02', stage: 1, type: 'system', title: 'Case file created', detail: 'Case file opened for a motor vehicle deposit refund claim.' },
      { id: 'v2-2', date: '2026-07-05', stage: 1, type: 'system', title: 'Eligibility screening passed', detail: 'Claim falls within the standard S$20,000 monetary limit and 2-year time bar.' },
      { id: 'v2-intake', date: '2026-07-05', stage: 1, type: 'user', title: 'Intake questionnaire completed', detail: 'Your answers have been saved to your case file.' },
      { id: 'v2-3', date: '2026-07-10', stage: 1, type: 'respondent', title: 'Respondent did not respond to negotiation', detail: 'No reply within the negotiation window on CJTS.' },
      { id: 'v2-4', date: '2026-07-18', stage: 2, type: 'user', title: 'Claim filed and lodgment fee paid', detail: 'Claim SCT/2026/00091 lodged with statement of claim and 4 labelled attachments.' },
      { id: 'v2-5', date: '2026-07-25', stage: 3, type: 'court', title: 'Correspondence received: Notice of service', detail: 'The State Courts confirmed the claim was served on the respondent.' },
      { id: 'v2-decl', date: '2026-08-01', stage: 4, type: 'user', title: 'Declaration of Service filed', detail: 'Declaration of Service filed on CJTS confirming the claim and Notice of Consultation were served on 25 July 2026.' },
      { id: 'v2-6', date: '2026-08-08', stage: 3, type: 'respondent', title: 'Response received', detail: 'The respondent disputes that the deposit is refundable.' },
      { id: 'v2-7', date: '2026-08-20', stage: 5, type: 'court', title: 'Correspondence received: Consultation notice', detail: 'Consultation before a Registrar fixed for 22 Sept 2026, 10:00am.' },
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
    eligibility: {
      amount: '850',
      date: '2026-05-02',
      subject: 'a',
      party: 'b',
      exclusions: ['i'],
      remedy: 'a',
    },
    intakeAnswers: {
      'open-1':
        'I bought a laptop from TechGadget Store for S$850 on 2 May 2026. The screen started flickering and cutting out within three weeks. The shop refused to refund or replace it, said the fault was my own doing, and is now claiming S$200 from me for a diagnostic and restocking fee.',
      'open-2':
        'I am a retail customer. I bought the laptop over the counter at their Sim Lim outlet on 2 May 2026 and had no dealings with them before that.',
      'open-3':
        'The laptop worked normally for about two and a half weeks. On 20 May 2026 the screen began flickering and going black for a few seconds at a time, mostly when the lid was moved. By 24 May 2026 it was happening several times an hour. I brought it back to the shop on 26 May 2026. They kept it for four days, then told me on 30 May 2026 that there was a hairline crack in the display ribbon caused by mishandling, that the warranty did not cover it, and that I owed S$200 for the diagnostic and for restocking. I refused to pay and asked for the laptop back. They returned it on 31 May 2026 in the same condition. I have not had it repaired since, because I did not want to change anything before this is resolved.',
      'open-4':
        'My position is that a laptop that fails within three weeks of purchase was not of satisfactory quality, and that I did nothing unusual with it. They say the damage was caused by mishandling and that their 7-day exchange policy had run out. I cannot prove exactly what is wrong inside the machine, and I have not obtained an independent inspection. I did carry it daily in a backpack, though in a padded sleeve.',
      'open-5':
        'A full refund of S$850 in return for the laptop. I am not claiming for anything else, and I dispute the S$200 they say I owe.',
      'open-6':
        'The tax invoice and card receipt dated 2 May 2026, the shop’s service job sheet from 26 May 2026, their assessment slip of 30 May 2026 stating the S$200 charge, two videos of the screen flickering taken on 22 and 24 May 2026, and the product page showing the one-year warranty advertised at the time of purchase.',
      'open-7':
        'I raised it with the store manager in person on 30 May 2026 and sent a written request for a refund on 5 June 2026. They replied on 9 June 2026 rejecting it. I filed the claim on 15 June 2026 after that.',
      'open-8':
        'I am unsure whether the 7-day exchange policy printed on the receipt limits what I can claim, and whether I need an independent technician’s report to show the fault was not caused by me. I also do not know how their S$200 counterclaim is dealt with alongside my own claim.',
      'open-9':
        'At the consultation on 20 August 2026 the shop offered a S$400 credit note rather than a refund, which I declined because I do not want to buy from them again. The advertised one-year warranty is what made me choose them over a cheaper listing elsewhere.',
      'open-10':
        'That it comes down to my word against a technician they employ, and that their S$200 counterclaim means I could end up worse off than if I had not filed at all.',
    },
    stageProgress: {
      1: { eligibility: true, assessment: true, accurate: true },
      2: { prepare: true, upload: true, review: true, submit: true, confirm: true },
      3: { serve: true, confirm: true, record: true },
      4: { complete: true, file: true, confirm: true },
      5: { 'check-date': true, prepare: true, attend: true },
      // Consultation did not resolve the matter and no further directions
      // were issued, so this stage was skipped straight to the hearing.
      6: { skipped: true },
      7: { 'check-date': true },
    },
    stageDates: { 3: '2026-06-25', 4: '2026-06-30', 5: '2026-08-20', 7: '2026-09-18' },
    events: [
      { id: 'v3-1', date: '2026-06-01', stage: 1, type: 'system', title: 'Case file created', detail: 'Case file opened for a contract for the sale of goods.' },
      { id: 'v3-2', date: '2026-06-03', stage: 1, type: 'system', title: 'Eligibility screening passed', detail: 'Claim falls within the standard S$20,000 monetary limit and 2-year time bar.' },
      { id: 'v3-intake', date: '2026-06-03', stage: 1, type: 'user', title: 'Intake questionnaire completed', detail: 'Your answers have been saved to your case file.' },
      { id: 'v3-3', date: '2026-06-15', stage: 2, type: 'user', title: 'Claim filed and lodgment fee paid', detail: 'Claim SCT/2026/00117 lodged with statement of claim and 3 labelled attachments.' },
      { id: 'v3-4', date: '2026-06-25', stage: 3, type: 'court', title: 'Correspondence received: Notice of service', detail: 'The State Courts confirmed the claim was served on the respondent.' },
      { id: 'v3-decl', date: '2026-06-30', stage: 4, type: 'user', title: 'Declaration of Service filed', detail: 'Declaration of Service filed on CJTS confirming the claim and Notice of Consultation were served on 25 June 2026.' },
      { id: 'v3-5', date: '2026-07-10', stage: 3, type: 'respondent', title: 'Response and counterclaim received', detail: 'The respondent disputes the defect and has filed a counterclaim for S$200.' },
      { id: 'v3-6', date: '2026-07-30', stage: 5, type: 'court', title: 'Correspondence received: Consultation notice', detail: 'Consultation before a Registrar held on 20 Aug 2026.' },
      { id: 'v3-7', date: '2026-08-20', stage: 7, type: 'court', title: 'Correspondence received: Hearing notice', detail: 'Consultation did not resolve the matter. Hearing before a Referee fixed for 18 Sept 2026.' },
    ],
    upcomingDates: [
      { date: '2026-09-18', label: 'Hearing before Referee', type: 'hearing' },
    ],
  },
]
