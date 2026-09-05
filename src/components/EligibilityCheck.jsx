import { eligibilityQuestions } from '../data/eligibility.js'
import DatePicker from './DatePicker.jsx'

// Deliberately shows no per-answer verdicts, icons or notes: the claimant
// should answer without being steered. Evaluation happens in Intake.
export default function EligibilityCheck({ answers, onChange }) {
  const toggleCheckbox = (q, value) => {
    const current = answers[q.id] ?? []
    let next
    if (value === q.noneValue) {
      next = current.includes(value) ? [] : [value]
    } else {
      next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current.filter((v) => v !== q.noneValue), value]
    }
    onChange(q.id, next)
  }

  return (
    <>
      {eligibilityQuestions.map((q, i) => (
        <fieldset key={q.id} className="question">
          <legend>
            <span className="qnum">{i + 1}</span> {q.text}
          </legend>
          {q.hint && <p className="muted small">{q.hint}</p>}

          {q.type === 'text' && (
            <input
              id={q.id}
              type="text"
              className="text-input"
              placeholder={q.placeholder}
              value={answers[q.id] ?? ''}
              onChange={(e) => onChange(q.id, e.target.value)}
            />
          )}

          {q.type === 'date' && (
            <DatePicker
              id={q.id}
              value={answers[q.id] ?? ''}
              placeholder={q.placeholder}
              onChange={(v) => onChange(q.id, v)}
            />
          )}

          {q.type === 'radio' && (
            <div className="options">
              {q.options.map((opt) => (
                <label key={opt.value} className={`option ${answers[q.id] === opt.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name={q.id}
                    value={opt.value}
                    checked={answers[q.id] === opt.value}
                    onChange={() => onChange(q.id, opt.value)}
                  />
                  <span className="option-label">{opt.label}</span>
                </label>
              ))}
            </div>
          )}

          {q.type === 'checkbox' && (
            <div className="options">
              {q.options.map((opt) => {
                const checked = (answers[q.id] ?? []).includes(opt.value)
                return (
                  <label key={opt.value} className={`option ${checked ? 'selected' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCheckbox(q, opt.value)} />
                    <span className="option-label">{opt.label}</span>
                  </label>
                )
              })}
            </div>
          )}

          {q.ref && <p className="elig-ref">{q.ref}</p>}
        </fieldset>
      ))}
    </>
  )
}
