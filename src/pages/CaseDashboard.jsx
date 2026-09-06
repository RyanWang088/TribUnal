import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'
import { stages, simulatedUpdates, currentStageOf } from '../data/caseEvents.js'
import { LAST_STAGE, countdownLabel, isStageComplete, stageTasksDone } from '../data/stages.js'
import { openQuestions } from '../data/questions.js'
import Timeline from '../components/Timeline.jsx'
import DisclaimerModal from '../components/DisclaimerModal.jsx'
import SuperBadge from '../components/SuperBadge.jsx'
import SuperEventForm from '../components/SuperEventForm.jsx'
import SuperCaseForm from '../components/SuperCaseForm.jsx'
import StageModal from '../components/StageModal.jsx'
import RealityCheck from './RealityCheck.jsx'
import CaseSummary from './CaseSummary.jsx'
import EvidenceMap from './EvidenceMap.jsx'

const eyebrowByView = { reality: 'Reality Check', summary: 'Case summary', evidence: 'Evidence map' }

const navItems = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'timeline', label: 'Timeline', icon: '◷' },
  { key: 'evidence', label: 'Evidence Map', icon: '◈' },
  { key: 'reality', label: 'Reality Check', icon: '⚑' },
  { key: 'summary', label: 'Case summary', icon: '≡' },
  { key: 'links', label: 'Relevant Links', icon: '¶' },
]


// Every case dashboard mount shows the disclaimer modal: first entry,
// a manual refresh, or navigating back into the case from elsewhere.
// It is deliberately not remembered across mounts.
export default function CaseDashboard() {
  const { caseId } = useParams()
  const {
    user,
    isSuper,
    logout,
    getCase,
    addEvent,
    updateEvent,
    removeEvent,
    updateCase,
    toggleStageTask,
    skipStage,
    setStageDate,
  } = useCase()
  const navigate = useNavigate()
  const [active, setActive] = useState('home')
  const [used, setUsed] = useState([])
  const [disclaimerOpen, setDisclaimerOpen] = useState(true)
  // Super-only editor state: which timeline event is open, whether the
  // "add event" form is showing, and which side panel is being edited.
  const [editingEventId, setEditingEventId] = useState(null)
  const [addingEvent, setAddingEvent] = useState(false)
  const [editingPanel, setEditingPanel] = useState(null)
  const [healthDraft, setHealthDraft] = useState(null)
  // Which stage's popup is open, or null. Any stage can be opened, not just
  // the current one, so the claimant can read ahead or look back.
  const [openStage, setOpenStage] = useState(null)

  const caseData = getCase(caseId)
  if (!caseData) return <Navigate to="/dashboard" replace />

  const { events, intakeAnswers, ref, title, claimType, respondent, amount, summary, healthOverride } = caseData
  const stageProgress = caseData.stageProgress ?? {}
  const stageDates = caseData.stageDates ?? {}
  const currentStage = currentStageOf(caseData)
  // The suggested next step is the current stage's own "what you need to do":
  // the first checkbox still outstanding, or where the case goes once the
  // stage is finished.
  const currentStageDef = stages.find((st) => st.id === currentStage)
  const outstanding = currentStageDef?.tasks.find((t) => !stageProgress[currentStage]?.[t.id])
  const nextStep = outstanding
    ? outstanding.label
    : currentStageDef?.next
      ? `${currentStageDef.next}`
      : 'Check the Tribunal Order and any deadlines it sets.'
  const correspondence = events.filter((ev) => ev.type === 'court' || ev.type === 'respondent')
  const questionIds = openQuestions.map((q) => q.id)
  const derivedAnswered = intakeAnswers ? questionIds.filter((id) => intakeAnswers[id] !== undefined).length : 0
  const answered = healthOverride?.answered ?? derivedAnswered

  function simulate(update) {
    addEvent(caseId, update.event)
    setUsed((prev) => [...prev, update.key])
  }

  function openHealthEditor() {
    setHealthDraft({ answered })
    setEditingPanel('health')
  }

  function saveHealth(e) {
    e.preventDefault()
    updateCase(caseId, { healthOverride: { answered: Number(healthDraft.answered) || 0 } })
    setEditingPanel(null)
  }

  const eventEditor = (ev) => (
    <SuperEventForm
      initial={ev}
      onSave={(patch) => {
        updateEvent(caseId, ev.id, patch)
        setEditingEventId(null)
      }}
      onCancel={() => setEditingEventId(null)}
      onDelete={() => {
        removeEvent(caseId, ev.id)
        setEditingEventId(null)
      }}
    />
  )

  function handleLogout() {
    logout()
    navigate('/login')
  }

  // Home always returns to the top. Relevant links lives at the bottom of
  // the home view, so it may need a render first (when leaving Reality
  // Check or Case summary) before there is anything to scroll to.
  function selectNav(key) {
    setActive(key)
    if (key === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (key === 'links') {
      setTimeout(() => document.getElementById('relevant-links')?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0)
    }
  }

  return (
    <div className="dash">
      {openStage !== null && (
        <StageModal
          stageId={openStage}
          progress={stageProgress}
          date={stageDates[openStage] ?? null}
          onToggle={(stageId, taskId) => toggleStageTask(caseId, stageId, taskId)}
          onSetDate={(stageId, date) => setStageDate(caseId, stageId, date)}
          onSkip={(stageId) => skipStage(caseId, stageId)}
          onClose={() => setOpenStage(null)}
        />
      )}
      {disclaimerOpen && <DisclaimerModal onContinue={() => setDisclaimerOpen(false)} />}

      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-logo">Trib</span>
          <span className="topbar-title">U</span>
          <span className="topbar-logo">nal</span>
          <span className="topbar-sub">Self-Represented Person Portal</span>
        </div>
        <div className="topbar-right">
          <SuperBadge />
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
                  onClick={() => selectNav(item.key)}
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
              <div className="eyebrow">{eyebrowByView[active] ?? 'Home'}</div>
              <h1>{title}</h1>
              <p>Welcome back, {user.name}.</p>
            </div>
            <div className="case-ref">
              Case file <strong>{ref}</strong>
            </div>
          </div>

          {active === 'reality' ? (
            <RealityCheck caseData={caseData} />
          ) : active === 'summary' ? (
            <CaseSummary caseData={caseData} />
          ) : active === 'evidence' ? (
            <EvidenceMap caseData={caseData} />
          ) : (
            <>
              <section className="card stage-card">
                <div className="card-head">
                  <h2>Where your case is</h2>
                  <span className="muted">
                    Stage {currentStage} of {LAST_STAGE}
                  </span>
                </div>
                <ol className="stage-track">
                  {stages.map((st) => {
                    const complete = isStageComplete(stageProgress, st.id)
                    const state = complete || st.id < currentStage ? 'done' : st.id === currentStage ? 'current' : ''
                    const ticked = stageTasksDone(stageProgress, st.id)
                    const countdown = st.dateKind ? countdownLabel(st.dateKind, stageDates[st.id]) : null
                    return (
                      <li key={st.id} className={state}>
                        <button
                          type="button"
                          className="stage-btn"
                          onClick={() => setOpenStage(st.id)}
                          aria-label={`Stage ${st.id}: ${st.label}`}
                        >
                          <span className="stage-num">{complete ? '✓' : st.id}</span>
                          <span className="stage-label">{st.short}</span>
                          <span className="stage-count">
                            {stageProgress[st.id]?.skipped ? 'Skipped' : `${ticked}/${st.tasks.length}`}
                          </span>
                          {countdown && <span className="stage-track-countdown">{countdown}</span>}
                        </button>
                      </li>
                    )
                  })}
                </ol>
                <div className="next-step">
                  <strong>Suggested next step:</strong> {nextStep}
                </div>
              </section>

              <div className="grid">
                <section className="card col-main">
                  <div className="card-head">
                    <h2>Case timeline</h2>
                    <span className="card-head-right">
                      <span className="muted">{events.length} events</span>
                      {isSuper && !addingEvent && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAddingEvent(true)}>
                          + Add event
                        </button>
                      )}
                    </span>
                  </div>
                  {addingEvent && (
                    <div className="super-add-event">
                      <SuperEventForm
                        onSave={(ev) => {
                          addEvent(caseId, ev)
                          setAddingEvent(false)
                        }}
                        onCancel={() => setAddingEvent(false)}
                      />
                    </div>
                  )}
                  <Timeline
                    events={events}
                    onEdit={isSuper ? (ev) => setEditingEventId(ev.id) : undefined}
                    editingId={editingEventId}
                    renderEditor={eventEditor}
                  />
                </section>

                <div className="col-side">
                  <section className="card">
                    <div className="card-head">
                      <h2>Relevant summaries</h2>
                      {isSuper && editingPanel !== 'summary' && (
                        <button type="button" className="btn-link" onClick={() => setEditingPanel('summary')}>
                          Edit
                        </button>
                      )}
                    </div>
                    {editingPanel === 'summary' ? (
                      <SuperCaseForm
                        caseData={caseData}
                        onSave={(patch) => {
                          updateCase(caseId, patch)
                          setEditingPanel(null)
                        }}
                        onCancel={() => setEditingPanel(null)}
                      />
                    ) : (
                      <>
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
                        {summary ? (
                          <p className="small muted">{summary}</p>
                        ) : intakeAnswers ? (
                          <p className="small muted">
                            Summary generated from your intake answers — verify every detail against your own
                            records before relying on it.
                          </p>
                        ) : (
                          <p className="small muted">Complete the intake questionnaire to generate a case summary.</p>
                        )}
                      </>
                    )}
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <h2>Correspondence</h2>
                      <span className="card-head-right">
                        {isSuper && (
                          <button type="button" className="btn-link" onClick={() => setAddingEvent(true)}>
                            + Add
                          </button>
                        )}
                        <span className="badge">{correspondence.length}</span>
                      </span>
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
                            <span className="grow">{ev.title}</span>
                            {isSuper && (
                              <button type="button" className="btn-link" onClick={() => setEditingEventId(ev.id)}>
                                Edit
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="card">
                    <div className="card-head">
                      <h2>Case health</h2>
                      {isSuper && editingPanel !== 'health' && (
                        <button type="button" className="btn-link" onClick={openHealthEditor}>
                          Edit
                        </button>
                      )}
                    </div>
                    {editingPanel === 'health' ? (
                      <form className="super-form" onSubmit={saveHealth}>
                        <div className="super-form-row">
                          <label>
                            Answered
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={healthDraft.answered}
                              onChange={(e) => setHealthDraft((d) => ({ ...d, answered: e.target.value }))}
                            />
                          </label>
                        </div>
                        <div className="super-actions">
                          <button type="submit" className="btn btn-primary btn-sm">
                            Save
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingPanel(null)}>
                            Cancel
                          </button>
                          {healthOverride && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm btn-danger"
                              onClick={() => {
                                updateCase(caseId, { healthOverride: null })
                                setEditingPanel(null)
                              }}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </form>
                    ) : (
                      <ul className="stat-list">
                        <li>
                          <span>Intake questions answered</span>
                          <strong className={answered === questionIds.length ? 'ok' : ''}>
                            {answered} / {questionIds.length}
                          </strong>
                        </li>
                      </ul>
                    )}
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
                          disabled={!isSuper && used.includes(u.key)}
                          onClick={() => simulate(u)}
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="card" id="relevant-links">
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
