import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'
import { openQuestions, NOT_SURE } from '../data/questions.js'

// Non-leading, open-ended questions only — no MCQ.
export default function Intake() {
  const { user, cases, saveIntake } = useCase()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('case') || cases[0]?.id
  const [answers, setAnswers] = useState({})
  const [files, setFiles] = useState({})
  const [error, setError] = useState('')

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

  const openComplete = openQuestions.every((q) => (answers[q.id] ?? '').trim() !== '')

  function submit(e) {
    e.preventDefault()
    if (!openComplete) {
      setError('Please answer every question. Type "I\'m not sure" if you don\'t know.')
      return
    }
    saveIntake(caseId, Object.keys(files).length ? { ...answers, files } : answers)
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
      </header>

      <form onSubmit={submit} className="intake-form">
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
            <button type="submit" className="btn btn-primary">
              Save and go to my dashboard
            </button>
          </div>
        </section>
      </form>
    </div>
  )
}
