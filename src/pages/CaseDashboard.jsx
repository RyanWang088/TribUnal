import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'
import { stages, simulatedUpdates } from '../data/caseEvents.js'
import { openQuestions, NOT_SURE } from '../data/questions.js'
import Timeline from '../components/Timeline.jsx'
import DisclaimerModal from '../components/DisclaimerModal.jsx'
import RealityCheck from './RealityCheck.jsx'

const navItems = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'case', label: 'My Case', icon: '▤' },
  { key: 'timeline', label: 'Timeline', icon: '◷' },
  { key: 'evidence', label: 'Evidence Map', icon: '◈' },
  { key: 'reality', label: 'Reality Check', icon: '⚑' },
  { key: 'readiness', label: 'SCT Readiness', icon: '✓' },
  { key: 'links', label: 'Relevant Links', icon: '¶' },
]

const nextStepByStage = {
  0: 'Confirm the SCT is the right forum, then invite the respondent to negotiate on CJTS.',
  1: 'Wait for the respondent to engage. If they do not, prepare your statement of claim.',
  2: 'Check that every fact in your narrative has a labelled attachment behind it.',
  3: 'Read the Response carefully. Update your Reality Check with the respondent\'s version of events.',
  4: 'Prepare your document bundle and decide your realistic best and worst outcomes before consultation.',
  5: 'Rehearse answering the Referee\'s questions directly. Bring originals of all evidence.',
  6: 'An order is not payment. Look up enforcement options in the State Courts if the respondent does not pay.',
}

// Every case dashboard mount shows the disclaimer modal: first entry,
// a manual refresh, or navigating back into the case from elsewhere.
// It is deliberately not remembered across mounts.
export default function CaseDashboard() {
  const { caseId } = useParams()
  const { user, logout, getCase, addEvent } = useCase()
  const navigate = useNavigate()
  const [active, setActive] = useState('home')
  const [used, setUsed] = useState([])
  const [disclaimerOpen, setDisclaimerOpen] = useState(true)

  const caseData = getCase(caseId)
  if (!caseData) return <Navigate to="/dashboard" replace />

  const { events, intakeAnswers, ref, title, claimType, respondent, amount } = caseData
  const currentStage = events.reduce((max, ev) => Math.max(max, ev.stage), 0)
  const correspondence = events.filter((ev) => ev.type === 'court' || ev.type === 'respondent')
  const questionIds = openQuestions.map((q) => q.id)
  const answered = intakeAnswers ? questionIds.filter((id) => intakeAnswers[id] !== undefined).length : 0
  const unknownCount = intakeAnswers
    ? questionIds.filter((id) => intakeAnswers[id] === NOT_SURE).length
    : 0
  const confirmedCount = answered - unknownCount

  function simulate(update) {
    addEvent(caseId, update.event)
    setUsed((prev) => [...prev, update.key])
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="dash">
      {disclaimerOpen && <DisclaimerModal onContinue={() => setDisclaimerOpen(false)} />}

      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-logo">Trib</span>
          <span className="topbar-title">Unal</span>
          <span className="topbar-sub">Self-Represented Person Portal</span>
        </div>
        <div className="topbar-right">
          <span className="topbar-user">{user.name}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="dash-body">
        <nav className="sidebar">
          <button className="btn-link back-link" onClick={() => navigate('/dashboard')}>
            ← All cases
          </button>
          <ul>
            {navItems.map((item) => (
              <li key={item.key}>
                <button
                  className={active === item.key ? 'active' : ''}
                  onClick={() => setActive(item.key)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="sidebar-foot">
            <button className="btn btn-outline btn-block" onClick={() => navigate(`/intake?case=${caseId}`)}>
              {intakeAnswers ? 'Redo intake' : 'Start intake'}
            </button>
          </div>
        </nav>

        <main className="content">
          <div className="content-head on-bg">
            <div>
              <div className="eyebrow">{active === 'reality' ? 'Reality Check' : 'Home'}</div>
              <h1>{title}</h1>
              <p>Welcome back, {user.name}.</p>
            </div>
            <div className="case-ref">
              Case file <strong>{ref}</strong>
            </div>
          </div>

          {active === 'reality' ? (
            <RealityCheck caseData={caseData} />
          ) : (
            <>
              <section className="card stage-card">
                <div className="card-head">
                  <h2>Where your case is</h2>
                  <span className="muted">Stage {currentStage} of 6</span>
                </div>
                <ol className="stage-track">
                  {stages.map((s) => (
                    <li
                      key={s.id}
                      className={s.id < currentStage ? 'done' : s.id === currentStage ? 'current' : ''}
                    >
                      <span className="stage-num">{s.id}</span>
                      <span className="stage-label">{s.label}</span>
                    </li>
                  ))}
                </ol>
                <div className="next-step">
                  <strong>Suggested next step:</strong> {nextStepByStage[currentStage]}
                </div>
              </section>

              <div className="grid">
                <section className="card col-main">
                  <div className="card-head">
                    <h2>Case timeline</h2>
                    <span className="muted">{events.length} events</span>
                  </div>
                  <Timeline events={events} />
                </section>

                <div className="col-side">
                  <section className="card">
                    <div className="card-head">
                      <h2>Relevant summaries</h2>
                    </div>
                    <ul className="summary-list">
                      <li>
                        <span className="muted">Claim type</span>
                        <span>{claimType}</span>
                      </li>
                      <li>
                        <span className="muted">Respondent</span>
                        <span>{respondent}</span>
                      </li>
                      <li>
                        <span className="muted">Amount claimed</span>
                        <span>S${amount.toLocaleString()}</span>
                      </li>
                    </ul>
                    {intakeAnswers ? (
                      <p className="small muted">
                        Summary generated from your intake answers. Lorem ipsum dolor sit amet, consectetur
                        adipiscing elit — verify every detail against your own records before relying on it.
                      </p>
                    ) : (
                      <p className="small muted">Complete the intake questionnaire to generate a case summary.</p>
                    )}
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <h2>Correspondence</h2>
                      <span className="badge">{correspondence.length}</span>
                    </div>
                    {correspondence.length === 0 ? (
                      <p className="muted">No correspondence from the court or respondent yet.</p>
                    ) : (
                      <ul className="plain-list">
                        {[...correspondence].reverse().map((ev) => (
                          <li key={ev.id}>
                            <span className={`pill pill-${ev.type}`}>
                              {ev.type === 'court' ? 'Court' : 'Respondent'}
                            </span>
                            <span>{ev.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <h2>Case health</h2>
                    </div>
                    <ul className="stat-list">
                      <li>
                        <span>Intake questions answered</span>
                        <strong>{answered} / 10</strong>
                      </li>
                      <li>
                        <span>Confirmed answers</span>
                        <strong className="ok">{confirmedCount}</strong>
                      </li>
                      <li>
                        <span>Marked "I'm not sure"</span>
                        <strong className="warn">{unknownCount}</strong>
                      </li>
                    </ul>
                  </section>

                  <section className="card sim-card">
                    <div className="card-head">
                      <h2>Simulate case update</h2>
                    </div>
                    <p className="muted small">
                      Demo only. These stand in for correspondence that would arrive from CJTS and update
                      the timeline automatically.
                    </p>
                    <div className="sim-buttons">
                      {simulatedUpdates.map((u) => (
                        <button
                          key={u.key}
                          className="btn btn-outline btn-sm"
                          disabled={used.includes(u.key)}
                          onClick={() => simulate(u)}
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <h2>Relevant links</h2>
                    </div>
                    <ul className="plain-list links">
                      <li>
                        <a href="https://www.judiciary.gov.sg/civil/small-claims" target="_blank" rel="noreferrer">
                          State Courts · Small Claims Tribunals
                        </a>
                      </li>
                      <li>
                        <a href="https://www.statecourts.gov.sg/cws/CJTS" target="_blank" rel="noreferrer">
                          CJTS · Community Justice and Tribunals System
                        </a>
                      </li>
                      <li>
                        <a href="https://sso.agc.gov.sg/Act/SCTA1984" target="_blank" rel="noreferrer">
                          Small Claims Tribunals Act 1984
                        </a>
                      </li>
                    </ul>
                  </section>
                </div>
              </div>
            </>
          )}

          <p className="footer-note">
            TribUnal organises and challenges your case. It does not give legal advice. Verify all
            procedural information against the official sources above before relying on it.
          </p>
        </main>
      </div>
    </div>
  )
}
