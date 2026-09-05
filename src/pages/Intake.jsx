import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'
import { openQuestions } from '../data/questions.js'
import { eligibilityQuestions, evaluateEligibility } from '../data/eligibility.js'
import EligibilityCheck from '../components/EligibilityCheck.jsx'
import { buildCaseFacts } from '../data/caseFacts.js'

// Asks the model for a short neutral title (and the respondent's name, if
// the claimant stated one). Best-effort: any failure returns null and the
// case keeps its placeholder title rather than blocking the save.
async function suggestTitle(sourceFacts) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch('/api/case-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFacts }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = await res.json()
    return { title: data.title || '', respondent: data.respondent || '' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Step 1: SCT eligibility screen. Answers are evaluated silently; a failing
// answer ends the intake and returns the claimant to the dashboard. No
// per-answer verdicts are shown so the questions cannot lead the claimant.
// Step 2: the open-ended questions.
//
// With no `case` query param this is a brand-new matter: the case file is
// only created when the form is saved, so leaving early logs nothing.
export default function Intake() {
  const { getCase, saveIntake, removeCase, addCase } = useCase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case')
  const [step, setStep] = useState(0)
  const [eligibility, setEligibility] = useState({})
  const [answers, setAnswers] = useState({})
  const [files, setFiles] = useState({})
  const [error, setError] = useState('')
  const [ineligible, setIneligible] = useState(false)
  const [saving, setSaving] = useState(false)

  const evaluation = evaluateEligibility(eligibility)

  const setEligibilityAnswer = (id, value) => {
    setError('')
    setEligibility((prev) => ({ ...prev, [id]: value }))
  }

  const setAnswer = (id, value) => {
    setError('')
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  // Names are read before setFiles: the updater runs after the input is
  // reset, at which point the FileList is already empty.
  const addFiles = (id, fileList) => {
    const names = Array.from(fileList, (f) => f.name)
    if (!names.length) return
    setFiles((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), ...names] }))
  }

  const removeFile = (id, index) => {
    setFiles((prev) => {
      const next = prev[id].filter((_, i) => i !== index)
      const { [id]: _removed, ...rest } = prev
      return next.length ? { ...rest, [id]: next } : rest
    })
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
    const current = caseId ? getCase(caseId) : null
    if (current && !current.intakeAnswers) removeCase(caseId)
    navigate('/dashboard')
  }

  const openComplete = openQuestions.every((q) => (answers[q.id] ?? '').trim() !== '')

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    if (!openComplete) {
      setError('Please answer every question.')
      return
    }
    const subject = eligibilityQuestions
      .find((q) => q.id === 'subject')
      .options.find((o) => o.value === eligibility.subject)
    const intakeAnswers = Object.keys(files).length ? { ...answers, files } : answers
    const existing = caseId ? getCase(caseId) : null

    setSaving(true)
    const suggested = await suggestTitle(
      buildCaseFacts({
        ref: existing?.ref ?? '',
        title: existing?.title ?? '',
        claimType: subject?.label ?? '',
        respondent: existing?.respondent ?? '',
        amount: evaluation.amount ?? 0,
        eligibility,
        intakeAnswers,
        events: existing?.events ?? [],
      }),
    )

    const id = caseId ?? addCase()
    saveIntake(id, intakeAnswers, {
      answers: eligibility,
      amount: evaluation.amount,
      claimType: subject?.label,
      title: suggested?.title,
      respondent: suggested?.respondent,
    })
    navigate(`/case/${id}`)
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
            {step === 0
              ? 'First, a few quick checks to confirm the Small Claims Tribunals can hear your claim.'
              : 'Answer these questions as factually as possible.'}
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
            <p className="muted">Based on the Small Claims Tribunals Act 1984 and related legislation.</p>
            <EligibilityCheck answers={eligibility} onChange={setEligibilityAnswer} />
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
            <p className="muted">Describe what happened. These questions are deliberately neutral.</p>
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
                          <li key={`${name}-${idx}`}>
                            <span className="upload-name">{name}</span>
                            <button
                              type="button"
                              className="upload-remove"
                              aria-label={`Remove ${name}`}
                              onClick={() => removeFile(q.id, idx)}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setStep(0)} disabled={saving}>
                Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save and go to my dashboard'}
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
