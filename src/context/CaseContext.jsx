import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { seedCases } from '../data/cases.js'

const CaseContext = createContext(null)

const today = () => new Date().toISOString().slice(0, 10)

// Demo-only account and session store. Credentials and case data sit in
// localStorage in plain text, which is fine for a hackathon prototype but
// must not be reused as-is in production: passwords need hashing and this
// needs a real backend.
const ACCOUNTS_KEY = 'tribunal.accounts'
const SESSION_KEY = 'tribunal.session'
const CASES_KEY = 'tribunal.cases'

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

// Seeds only on the very first run. Once anything has been stored, that is
// the source of truth — including an empty list, so deleting every case does
// not bring the demo seeds back.
function loadCases() {
  try {
    const raw = localStorage.getItem(CASES_KEY)
    if (raw === null) return seedCases
    const stored = JSON.parse(raw)
    return Array.isArray(stored) ? stored : seedCases
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
  }, [cases])

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
        const seq = String(cases.length + 1).padStart(4, '0')
        const id = `cp-2026-${seq}-${Date.now().toString(36)}`
        const newCase = {
          id,
          ref: `CP-2026-${seq}`,
          title: 'New matter',
          claimType: 'Not yet specified',
          respondent: 'Not yet specified',
          amount: 0,
          intakeAnswers: null,
          upcomingDates: [],
          events: [
            {
              id: `seed-${id}-1`,
              date: today(),
              stage: 0,
              type: 'system',
              title: 'Case file created',
              detail: 'TribUnal opened a new case file for this matter.',
            },
            {
              id: `seed-${id}-2`,
              date: today(),
              stage: 0,
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
      removeCase: (caseId) => setCases((prev) => prev.filter((c) => c.id !== caseId)),
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
      saveIntake: (caseId, answers, eligibility) => {
        setCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  intakeAnswers: answers,
                  eligibility: eligibility?.answers ?? c.eligibility ?? null,
                  amount: eligibility?.amount ?? c.amount,
                  claimType: eligibility?.claimType ?? c.claimType,
                  events: [
                    ...c.events,
                    {
                      id: `intake-${Date.now()}`,
                      date: today(),
                      stage: 0,
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
