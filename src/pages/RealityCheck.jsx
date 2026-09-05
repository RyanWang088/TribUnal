import { useState } from 'react'
import { openQuestions } from '../data/questions.js'

const VERDICT_META = {
  confirmed: { icon: '🟢', label: 'Confirmed', className: 'verdict-confirmed' },
  needs_verification: { icon: '🟡', label: 'Needs verification', className: 'verdict-needs' },
  unsupported: { icon: '🔴', label: 'Unsupported', className: 'verdict-unsupported' },
}

const allQuestions = openQuestions

// Turns the case's confirmed facts into a plain-language object the model
// is asked to treat as ground truth. Nothing here is generated — it is
// exactly what the claimant entered.
function buildSourceFacts(caseData) {
  const { claimType, respondent, amount, intakeAnswers } = caseData
  const answers = {}
  if (intakeAnswers) {
    allQuestions.forEach((q) => {
      if (intakeAnswers[q.id] !== undefined) {
        answers[q.text] = intakeAnswers[q.id]
      }
    })
  }
  return { claimType, respondent, amountClaimed: amount, intakeAnswers: answers }
}

// Reality Check sends the claimant's confirmed facts and a draft statement
// (their own writing, or something a separate AI assistant produced) to a
// small backend, which asks the model to flag anything unsupported or
// one-sided. See server/index.js for the actual model call — the API key
// never reaches the browser.
export default function RealityCheck({ caseData }) {
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function runCheck() {
    if (!draft.trim()) {
      setError('Paste or type the statement you want checked first.')
      return
    }
    setStatus('loading')
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/reality-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceFacts: buildSourceFacts(caseData), draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setStatus('error')
        return
      }
      setResult(data)
      setStatus('done')
    } catch {
      setError('Could not reach the Reality Check server. Is it running (npm run server)?')
      setStatus('error')
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Reality Check</h2>
        <span className="muted small">Stress-test a statement before you rely on it</span>
      </div>
      <p className="muted small">
        Paste a statement you wrote yourself, or something a separate AI assistant produced for you.
        Reality Check compares it against the facts you confirmed during intake and flags anything it
        cannot trace back to them, plus any one-sided or leading framing.
      </p>

      <textarea
        className="reality-input"
        rows={6}
        placeholder="e.g. On 5 May the contractor promised the renovation would be completed by 30 June for $4,000. They clearly breached the contract and owe me a full refund..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={runCheck} disabled={status === 'loading'}>
          {status === 'loading' ? 'Checking…' : 'Run Reality Check'}
        </button>
      </div>

      {result && (
        <div className="reality-results">
          <div className="reality-note">{result.overall_note}</div>

          <h3>Claims in your statement</h3>
          <ul className="reality-claims">
            {result.claims.map((c, i) => {
              const meta = VERDICT_META[c.verdict] ?? VERDICT_META.needs_verification
              return (
                <li key={i} className={`reality-claim ${meta.className}`}>
                  <div className="reality-claim-head">
                    <span>{meta.icon}</span>
                    <strong>{meta.label}</strong>
                  </div>
                  <p className="reality-claim-statement">&ldquo;{c.statement}&rdquo;</p>
                  <p className="muted small">{c.reason}</p>
                </li>
              )
            })}
          </ul>

          <h3>Bias and framing flags</h3>
          {result.bias_flags.length === 0 ? (
            <p className="muted small">No one-sided or leading framing detected.</p>
          ) : (
            <ul className="reality-claims">
              {result.bias_flags.map((b, i) => (
                <li key={i} className="reality-claim verdict-needs">
                  <div className="reality-claim-head">
                    <span>⚠</span>
                    <strong>{b.issue}</strong>
                  </div>
                  <p className="reality-claim-statement">&ldquo;{b.quote}&rdquo;</p>
                  <p className="muted small">{b.explanation}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
