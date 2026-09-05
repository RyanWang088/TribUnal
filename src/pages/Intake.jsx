import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'
import { openQuestions, NOT_SURE } from '../data/questions.js'
import { eligibilityQuestions, evaluateEligibility } from '../data/eligibility.js'
import EligibilityCheck from '../components/EligibilityCheck.jsx'

// Step 1: SCT eligibility screen. Any ❌ ends the intake and returns the
// claimant to the dashboard. Step 2: the open-ended questions.
export default function Intake() {
  const { user, cases, getCase, saveIntake, removeCase } = useCase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case') || cases[0]?.id
  const [step, setStep] = useState(0)
  const [eligibility, setEligibility] = useState({})
  const [answers, setAnswers] = useState({})
  const [files, setFiles] = useState({})
  const [error, setError] = useState('')
  const [ineligible, setIneligible] = useState(false)

  const evaluation = evaluateEligibility(eligibility)

  const setEligibilityAnswer = (id, value) => {
    setError('')
    setEligibility((prev) => ({ ...prev, [id]: value }))
  }

  const setAnswer = (id, value) => {
    setError('')
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const addFiles = (id, fileList) => {
    setFiles((prev) => ({
      ...prev,
      [id]: [...(prev[id] ?? []), ...Array.from(fileList).map((f) => f.name)],
    }))
  }

  function continueToStep2() {
    if (!evaluation.complete) {
      setError('Please answer every question. Amounts must be a number and dates must be a past date.')
      return
    }
    if (evaluation.failed) {
      setIneligible(true)
      return
    }
    setStep(1)
    window.scrollTo(0, 0)
  }

  function leaveIneligible() {
    const current = getCase(caseId)
    if (current && !current.intakeAnswers) removeCase(caseId)
    navigate('/dashboard')
  }

  const openComplete = openQuestions.every((q) => (answers[q.id] ?? '').trim() !== '')

  function submit(e) {
    e.preventDefault()
    if (!openComplete) {
      setError('Please answer every question. Type "I\'m not sure" if you don\'t know.')
      return
    }
    const subject = eligibilityQuestions
      .find((q) => q.id === 'subject')
      .options.find((o) => o.value === eligibility.subject)
    saveIntake(caseId, Object.keys(files).length ? { ...answers, files } : answers, {
      answers: eligibility,
      amount: evaluation.amount,
      claimType: subject?.label,
    })
    navigate(`/case/${caseId}`)
  }

  return (
    <div className="intake-page">
      <header className="intake-header on-bg">
        <div>
          <button type="button" className="btn btn-link intake-back" onClick={() => navigate('/dashboard')}>
            &larr; Back to all matters
          </button>
          <div className="eyebrow">Step {step + 1} of 2 · {step === 0 ? 'SCT eligibility' : 'Intake'}</div>
          <h1>Why do you want to file a Small Claims Tribunals claim?</h1>
          <p>
            Hello {user.name}.{' '}
            {step === 0
              ? 'First, a few quick checks to confirm the Small Claims Tribunals can hear your claim.'
              : "Answer these questions as factually as you can. If you don't know something, say so. We record that as unknown rather than guessing."}
          </p>
        </div>
        <ol className="stepper">
          <li className={step === 0 ? 'active' : 'done'}>SCT eligibility</li>
          <li className={step === 1 ? 'active' : ''}>In your own words</li>
        </ol>
      </header>

      <form onSubmit={submit} className="intake-form">
        {step === 0 && (
          <section className="qa-section">
            <h2>SCT Eligibility Questionnaire</h2>
            <p className="muted">
              Based on the Small Claims Tribunals Act 1984 and related legislation. ✅ eligible · ⚠️ eligible
              with a condition · ❌ not eligible.
            </p>
            <EligibilityCheck answers={eligibility} evaluation={evaluation} onChange={setEligibilityAnswer} />
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={continueToStep2}>
                Check eligibility and continue
              </button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="qa-section">
            <h2>In your own words</h2>
            <p className="muted">
              These questions are deliberately neutral. Describe what happened, not what you think it
              means legally.
            </p>
            {openQuestions.map((q, i) => (
              <div key={q.id} className="question">
                <label htmlFor={q.id}>
                  <span className="qnum">{i + 1}</span> {q.text}
                </label>
                {q.hint && <p className="muted small">{q.hint}</p>}
                <textarea
                  id={q.id}
                  rows={4}
                  placeholder={q.placeholder}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
                {q.upload && (
                  <div className="upload-field">
                    <label className="btn btn-outline btn-upload">
                      Upload files
                      <input
                        type="file"
                        multiple
                        hidden
                        onChange={(e) => {
                          addFiles(q.id, e.target.files)
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {(files[q.id]?.length ?? 0) > 0 && (
                      <ul className="upload-list">
                        {files[q.id].map((name, idx) => (
                          <li key={`${name}-${idx}`}>{name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <button type="button" className="btn btn-link" onClick={() => setAnswer(q.id, NOT_SURE)}>
                  I&apos;m not sure
                </button>
              </div>
            ))}
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="submit" className="btn btn-primary">
                Save and go to my dashboard
              </button>
            </div>
          </section>
        )}
      </form>

      {ineligible && (
        <div className="disclaimer-overlay" role="dialog" aria-modal="true" aria-labelledby="ineligible-title">
          <div className="disclaimer-box">
            <div className="disclaimer-head">
              <span className="disclaimer-flag">❌</span>
              <h2 id="ineligible-title">Not eligible</h2>
            </div>
            <div className="disclaimer-body">
              <p>Sorry, you are ineligible to file for Small Claim Tribunal.</p>
              <p className="muted small">
                Based on your answers, this claim falls outside what the Small Claims Tribunals can hear.
                You may wish to seek advice on the appropriate forum.
              </p>
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={leaveIneligible}>
              Back to main page
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
