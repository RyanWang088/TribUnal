import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { SEED_VERSION, seedCases } from '../data/cases.js'
import { buildCaseFacts } from '../data/caseFacts.js'
import { PLACEHOLDER_TITLE, suggestTitle } from '../data/caseTitle.js'
import { deleteCaseDocuments } from '../data/documentStore.js'

const CaseContext = createContext(null)

const today = () => new Date().toISOString().slice(0, 10)

// Demo-only account and session store. Credentials and case data sit in
// localStorage in plain text, which is fine for a hackathon prototype but
// must not be reused as-is in production: passwords need hashing and this
// needs a real backend.
const ACCOUNTS_KEY = 'tribunal.accounts'
const SESSION_KEY = 'tribunal.session'
const CASES_KEY = 'tribunal.cases'
const SEED_VERSION_KEY = 'tribunal.seedVersion'

// Built-in account that always works, even on a fresh browser with no
// localStorage accounts. Prototype only — this is visible in source.
const MASTER_ACCOUNT = { username: 'rwks1688@gmail.com', password: 'Ryan2109', name: 'Ryan' }
// Demo-only presenter account. Unlocks inline editing of every case field,
// timeline event and dashboard panel so a walkthrough can be staged live.
const SUPER_ACCOUNT = { username: 'abc@gmail.com', password: 'Password123', name: 'Super User', role: 'super' }
const BUILT_IN = [SUPER_ACCOUNT, MASTER_ACCOUNT]

function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) ?? {}
  } catch {
    return {}
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

// Restores the logged-in user from the last session, if any, so a page
// refresh keeps the claimant on the case they were looking at instead of
// bouncing them back to the login page.
function loadSessionUser() {
  try {
    const key = localStorage.getItem(SESSION_KEY)
    if (!key) return null
    const builtIn = BUILT_IN.find((a) => a.username === key)
    if (builtIn) return { name: builtIn.name, role: builtIn.role }
    const account = loadAccounts()[key]
    return account ? { name: account.name } : null
  } catch {
    return null
  }
}

// Replaces every stored demo case with its current definition, restoring any
// that had been deleted, and keeps cases created through the app as they are.
function refreshSeeds(stored) {
  const seedIds = new Set(seedCases.map((c) => c.id))
  return [...seedCases, ...stored.filter((c) => !seedIds.has(c.id))]
}

// Seeds on the very first run. After that the stored list is the source of
// truth — including an empty list, so deleting every case does not bring the
// demo seeds back. The one exception is a SEED_VERSION bump, which refreshes
// the demo cases in place so edits to cases.js show up on the next reload
// without clearing localStorage.
function loadCases() {
  try {
    const raw = localStorage.getItem(CASES_KEY)
    if (raw === null) return seedCases
    const stored = JSON.parse(raw)
    if (!Array.isArray(stored)) return seedCases
    if (localStorage.getItem(SEED_VERSION_KEY) === String(SEED_VERSION)) return stored
    return refreshSeeds(stored)
  } catch {
    return seedCases
  }
}

export function CaseProvider({ children }) {
  const [user, setUser] = useState(loadSessionUser)
  const [authError, setAuthError] = useState('')
  const [cases, setCases] = useState(loadCases)

  useEffect(() => {
    localStorage.setItem(CASES_KEY, JSON.stringify(cases))
    localStorage.setItem(SEED_VERSION_KEY, String(SEED_VERSION))
  }, [cases])

  // Backfills the AI title for any completed case still carrying the
  // placeholder (saved before the feature existed, or while the API was
  // unreachable). Each case is attempted once per page load.
  const titleAttempted = useRef(new Set())
  useEffect(() => {
    if (!user) return
    for (const c of cases) {
      if (!c.intakeAnswers || c.title !== PLACEHOLDER_TITLE || titleAttempted.current.has(c.id)) continue
      titleAttempted.current.add(c.id)
      suggestTitle(buildCaseFacts(c)).then((suggested) => {
        if (!suggested?.title) return
        setCases((prev) =>
          prev.map((x) =>
            x.id === c.id && x.title === PLACEHOLDER_TITLE
              ? { ...x, title: suggested.title, respondent: suggested.respondent || x.respondent }
              : x,
          ),
        )
      })
    }
  }, [user, cases])

  const value = useMemo(
    () => ({
      user,
      isSuper: user?.role === 'super',
      authError,
      clearAuthError: () => setAuthError(''),
      signUp: (username, password, name) => {
        const key = username.trim().toLowerCase()
        const accounts = loadAccounts()
        if (accounts[key] || BUILT_IN.some((a) => a.username === key)) {
          setAuthError('That username is already taken. Try logging in instead.')
          return false
        }
        accounts[key] = { password, name: name.trim() || username.trim() }
        saveAccounts(accounts)
        localStorage.setItem(SESSION_KEY, key)
        setAuthError('')
        setUser({ name: accounts[key].name })
        return true
      },
      login: (username, password) => {
        const key = username.trim().toLowerCase()
        const builtIn = BUILT_IN.find((a) => a.username === key && a.password === password)
        if (builtIn) {
          localStorage.setItem(SESSION_KEY, key)
          setAuthError('')
          setUser({ name: builtIn.name, role: builtIn.role })
          return true
        }
        const accounts = loadAccounts()
        const account = accounts[key]
        if (!account || account.password !== password) {
          setAuthError('Incorrect username or password.')
          return false
        }
        localStorage.setItem(SESSION_KEY, key)
        setAuthError('')
        setUser({ name: account.name })
        return true
      },
      logout: () => {
        localStorage.removeItem(SESSION_KEY)
        setUser(null)
      },

      cases,
      getCase: (caseId) => cases.find((c) => c.id === caseId),
      // Creates a brand-new matter and returns its id. It starts with only
      // the forum-check stage done (case file opened, eligibility screened)
      // — no negotiation, filing or hearing dates yet — so it has nothing
      // in `upcomingDates` and correctly stays off the master calendar
      // until it progresses further.
      addCase: () => {
        const year = new Date().getFullYear()
        // Next number after the highest existing ref, so deleting a case
        // never causes a later one to reuse its number.
        const highest = cases.reduce((max, c) => {
          const n = Number(/^CP-\d{4}-(\d+)$/.exec(c.ref ?? '')?.[1])
          return Number.isFinite(n) ? Math.max(max, n) : max
        }, 0)
        const seq = String(highest + 1).padStart(4, '0')
        const id = `cp-${year}-${seq}-${Date.now().toString(36)}`
        const newCase = {
          id,
          ref: `CP-${year}-${seq}`,
          title: PLACEHOLDER_TITLE,
          claimType: 'Not yet specified',
          respondent: 'Not yet specified',
          amount: 0,
          intakeAnswers: null,
          upcomingDates: [],
          events: [
            {
              id: `seed-${id}-1`,
              date: today(),
              stage: 1,
              type: 'system',
              title: 'Case file created',
              detail: 'TribUnal opened a new case file for this matter.',
            },
            {
              id: `seed-${id}-2`,
              date: today(),
              stage: 1,
              type: 'system',
              title: 'Eligibility screening passed',
              detail:
                'Claim type, monetary limit (S$20,000) and 2-year limitation period checked against official SCT sources.',
            },
          ],
        }
        setCases((prev) => [...prev, newCase])
        return id
      },
      // Stage checklists. `stageProgress` is keyed by stage id, then by task
      // id; `skipped` marks an optional stage the claimant stepped past.
      // Completing every task is what advances the case (see currentStageOf).
      toggleStageTask: (caseId, stageId, taskId) =>
        setCases((prev) =>
          prev.map((c) => {
            if (c.id !== caseId) return c
            const progress = c.stageProgress ?? {}
            const stage = { ...(progress[stageId] ?? {}) }
            if (stage[taskId]) delete stage[taskId]
            else stage[taskId] = true
            return { ...c, stageProgress: { ...progress, [stageId]: stage } }
          }),
        ),
      skipStage: (caseId, stageId) =>
        setCases((prev) =>
          prev.map((c) => {
            if (c.id !== caseId) return c
            const progress = c.stageProgress ?? {}
            const stage = { ...(progress[stageId] ?? {}) }
            if (stage.skipped) delete stage.skipped
            else stage.skipped = true
            return { ...c, stageProgress: { ...progress, [stageId]: stage } }
          }),
        ),
      setStageDate: (caseId, stageId, date) =>
        setCases((prev) =>
          prev.map((c) =>
            c.id === caseId ? { ...c, stageDates: { ...(c.stageDates ?? {}), [stageId]: date } } : c,
          ),
        ),
      // Records the claimant's own verification of one citation. Keyed by
      // citation content (see data/citations.js), so a regenerated summary
      // keeps the ticks for citations that came back word for word and loses
      // them for anything that changed.
      setCitationCheck: (caseId, key, questionId, value) =>
        setCases((prev) =>
          prev.map((c) => {
            if (c.id !== caseId) return c
            const checks = c.citationChecks ?? {}
            const entry = { ...(checks[key] ?? {}) }
            if (value) entry[questionId] = new Date().toISOString()
            else delete entry[questionId]
            return { ...c, citationChecks: { ...checks, [key]: entry } }
          }),
        ),
      removeCase: (caseId) => {
        setCases((prev) => prev.filter((c) => c.id !== caseId))
        deleteCaseDocuments(caseId).catch(() => {})
      },
      updateCase: (caseId, patch) =>
        setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, ...patch } : c))),
      updateEvent: (caseId, eventId, patch) =>
        setCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? { ...c, events: c.events.map((ev) => (ev.id === eventId ? { ...ev, ...patch } : ev)) }
              : c,
          ),
        ),
      removeEvent: (caseId, eventId) =>
        setCases((prev) =>
          prev.map((c) => (c.id === caseId ? { ...c, events: c.events.filter((ev) => ev.id !== eventId) } : c)),
        ),
      // `meta` carries what the intake derived about the case: the
      // eligibility answers, amount and claim type, plus the AI-suggested
      // title and respondent (either may be missing if the model call failed).
      saveIntake: (caseId, answers, meta) => {
        setCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  intakeAnswers: answers,
                  eligibility: meta?.answers ?? c.eligibility ?? null,
                  amount: meta?.amount ?? c.amount,
                  claimType: meta?.claimType ?? c.claimType,
                  title: meta?.title || c.title,
                  respondent: meta?.respondent || c.respondent,
                  events: [
                    ...c.events,
                    {
                      id: `intake-${Date.now()}`,
                      date: today(),
                      stage: 1,
                      type: 'user',
                      title: 'Intake questionnaire completed',
                      detail: 'Your answers have been saved to your case file.',
                    },
                  ],
                }
              : c,
          ),
        )
      },
      addEvent: (caseId, event) =>
        setCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  events: [...c.events, { id: `${event.type}-${Date.now()}`, date: today(), ...event }],
                }
              : c,
          ),
        ),
    }),
    [user, authError, cases],
  )

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>
}

export function useCase() {
  const ctx = useContext(CaseContext)
  if (!ctx) throw new Error('useCase must be used inside CaseProvider')
  return ctx
}
