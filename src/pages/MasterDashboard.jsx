import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'
import { stages } from '../data/caseEvents.js'
import CaseCalendar from '../components/CaseCalendar.jsx'

const stageLabel = (id) => stages[id]?.label ?? 'Unknown'

export default function MasterDashboard() {
  const { user, logout, cases, addCase } = useCase()
  const navigate = useNavigate()

  function handleAddCase() {
    const id = addCase()
    navigate(`/intake?case=${id}`)
  }

  const calendarItems = useMemo(
    () =>
      cases.flatMap((c) =>
        (c.upcomingDates ?? []).map((d) => ({
          ...d,
          caseId: c.id,
          caseRef: c.ref,
          caseTitle: c.title,
        })),
      ),
    [cases],
  )

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="dash">
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

      <main className="content content-master">
        <div className="content-head on-bg">
          <div>
            <div className="eyebrow">All matters</div>
            <h1>Welcome back, {user.name}</h1>
            <p>An overview of every case you are tracking, and what is coming up next across all of them.</p>
          </div>
          <button type="button" className="btn btn-primary add-case-btn" onClick={handleAddCase}>
            + Add case
          </button>
        </div>

        <div className="grid master-grid">
          <section className="card col-main">
            <div className="card-head">
              <h2>Overview calendar</h2>
              <span className="muted">{calendarItems.length} upcoming</span>
            </div>
            <CaseCalendar items={calendarItems} onSelectCase={(id) => navigate(`/case/${id}`)} />
          </section>

          <div className="col-side">
            <section className="card">
              <div className="card-head">
                <h2>Case count</h2>
              </div>
              <ul className="stat-list">
                <li>
                  <span>Total matters</span>
                  <strong>{cases.length}</strong>
                </li>
                <li>
                  <span>Awaiting intake</span>
                  <strong className="warn">{cases.filter((c) => !c.intakeAnswers).length}</strong>
                </li>
                <li>
                  <span>With a key date this month</span>
                  <strong className="ok">{calendarItems.length}</strong>
                </li>
              </ul>
            </section>
          </div>
        </div>

        <section className="card">
          <div className="card-head">
            <h2>Your matters</h2>
            <span className="muted">Click a case to open its dashboard</span>
          </div>
          <div className="case-cards">
            {cases.map((c) => {
              const currentStage = c.events.reduce((max, ev) => Math.max(max, ev.stage), 0)
              return (
                <button key={c.id} className="case-card" onClick={() => navigate(`/case/${c.id}`)}>
                  <div className="case-card-top">
                    <span className="case-card-ref">{c.ref}</span>
                    <span className="pill pill-stage">
                      Stage {currentStage} · {stageLabel(currentStage)}
                    </span>
                  </div>
                  <h3>{c.title}</h3>
                  <p className="muted small">{c.claimType}</p>
                  <div className="case-card-meta">
                    <span>Respondent: {c.respondent}</span>
                    <span>Amount: S${c.amount.toLocaleString()}</span>
                  </div>
                  {!c.intakeAnswers && <span className="pill pill-respondent">Intake not started</span>}
                </button>
              )
            })}
          </div>
        </section>

        <p className="footer-note on-bg">
          TribUnal organises and challenges each of your cases. It does not give legal advice. Verify
          all procedural information against official sources before relying on it.
        </p>
      </main>
    </div>
  )
}
