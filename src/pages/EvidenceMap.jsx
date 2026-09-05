import { useNavigate } from 'react-router-dom'
import { buildCaseFacts } from '../data/caseFacts.js'

// Read-only record of what the claimant entered at intake. It deliberately
// renders plain text, not inputs: answers can only be changed by redoing
// the intake, so what the AI features work from is always what is shown.
export default function EvidenceMap({ caseData }) {
  const navigate = useNavigate()
  const facts = buildCaseFacts(caseData)
  const step1 = facts.eligibilityAnswers
  const step2 = facts.intakeAnswers
  const evidence = facts.evidenceUploaded ?? {}

  if (!step1 && !step2) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Evidence map</h2>
        </div>
        <p className="muted">Nothing recorded yet — the evidence map fills in once the intake is completed.</p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/intake?case=${caseData.id}`)}>
            Start intake
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Step 1 · SCT eligibility</h2>
          <span className="muted small">Read-only</span>
        </div>
        {step1 ? (
          <ol className="evidence-list">
            {Object.entries(step1).map(([question, answer], i) => (
              <li key={question} className="evidence-item">
                <span className="qnum">{i + 1}</span>
                <div>
                  <div className="evidence-q">{question}</div>
                  <div className="evidence-a">{Array.isArray(answer) ? answer.join('; ') : answer}</div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted small">No eligibility answers were recorded for this case.</p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Step 2 · In your own words</h2>
          <span className="muted small">Read-only</span>
        </div>
        {step2 ? (
          <ol className="evidence-list">
            {Object.entries(step2).map(([question, answer], i) => (
              <li key={question} className="evidence-item">
                <span className="qnum">{i + 1}</span>
                <div>
                  <div className="evidence-q">{question}</div>
                  <div className="evidence-a">{answer}</div>
                  {evidence[question]?.length > 0 && (
                    <ul className="evidence-files">
                      {evidence[question].map((name, idx) => (
                        <li key={`${name}-${idx}`}>{name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted small">The intake questionnaire has not been completed for this case.</p>
        )}
      </section>
    </>
  )
}
