import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'
import { mcqQuestions, openQuestions, NOT_SURE } from '../data/questions.js'

// Two sections, always in this order:
//   1. Short-ended (MCQ) questions
//   2. Non-leading open-ended questions
export default function Intake() {
  const { user, cases, saveIntake } = useCase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case') || cases[0]?.id
  const [section, setSection] = useState(0)
  const [answers, setAnswers] = useState({})
  const [error, setError] = useState('')

  const setAnswer = (id, value) => {
    setError('')
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const mcqComplete = mcqQuestions.every((q) => answers[q.id])
  const openComplete = openQuestions.every((q) => (answers[q.id] ?? '').trim() !== '')

  function nextSection() {
    if (!mcqComplete) {
      setError('Please answer every question. Pick "I\'m not sure" if you don\'t know.')
      return
    }
    setSection(1)
    window.scrollTo(0, 0)
  }

  function submit(e) {
    e.preventDefault()
    if (!openComplete) {
      setError('Please answer every question. Type "I\'m not sure" if you don\'t know.')
      return
    }
    saveIntake(caseId, answers)
    navigate(`/case/${caseId}`)
  }

  return (
    <div className="intake-page">
      <header className="intake-header on-bg">
        <div>
          <div className="eyebrow">Step 1 of 2 · Intake</div>
          <h1>Why do you want to file a Small Claims Tribunals claim?</h1>
          <p>
            Hello {user.name}. Answer these questions as factually as you can. If you don&apos;t know
            something, say so. We record that as <strong>unknown</strong> rather than guessing.
          </p>
        </div>
        <ol className="stepper">
          <li className={section === 0 ? 'active' : 'done'}>Short questions</li>
          <li className={section === 1 ? 'active' : ''}>In your own words</li>
        </ol>
      </header>

      <form onSubmit={submit} className="intake-form">
        {section === 0 && (
          <section className="qa-section">
            <h2>Part A · Short questions</h2>
            <p className="muted">Pick the option that best fits. One answer per question.</p>
            {mcqQuestions.map((q, i) => (
              <fieldset key={q.id} className="question">
                <legend>
                  <span className="qnum">{i + 1}</span> {q.text}
                </legend>
                <div className="options">
                  {[...q.options, NOT_SURE].map((opt) => (
                    <label
                      key={opt}
                      className={`option ${answers[q.id] === opt ? 'selected' : ''} ${
                        opt === NOT_SURE ? 'option-unsure' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswer(q.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={nextSection}>
                Continue to Part B
              </button>
            </div>
          </section>
        )}

        {section === 1 && (
          <section className="qa-section">
            <h2>Part B · In your own words</h2>
            <p className="muted">
              These questions are deliberately neutral. Describe what happened, not what you think it
              means legally.
            </p>
            {openQuestions.map((q, i) => (
              <div key={q.id} className="question">
                <label htmlFor={q.id}>
                  <span className="qnum">{mcqQuestions.length + i + 1}</span> {q.text}
                </label>
                <textarea
                  id={q.id}
                  rows={4}
                  placeholder={q.placeholder}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={() => setAnswer(q.id, NOT_SURE)}
                >
                  I&apos;m not sure
                </button>
              </div>
            ))}
            {error && <div className="form-error">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setSection(0)}>
                Back
              </button>
              <button type="submit" className="btn btn-primary">
                Save and go to my dashboard
              </button>
            </div>
          </section>
        )}
      </form>
    </div>
  )
}
