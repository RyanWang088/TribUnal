import { eligibilityQuestions } from '../data/eligibility.js'

const STATUS_ICON = { ok: '✅', warn: '⚠️', fail: '❌' }

export default function EligibilityCheck({ answers, evaluation, onChange }) {
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
      {eligibilityQuestions.map((q, i) => {
        const status = evaluation.perQuestion[q.id]
        const showNote = status?.status === 'warn' && status.note
        return (
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
                    {answers[q.id] === opt.value && (
                      <span className="option-status">{STATUS_ICON[opt.status]}</span>
                    )}
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
                      {checked && <span className="option-status">{STATUS_ICON[opt.status]}</span>}
                    </label>
                  )
                })}
              </div>
            )}

            {q.type === 'text' && status?.status && (
              <p className={`elig-note elig-${status.status}`}>
                {STATUS_ICON[status.status]} {status.note}
              </p>
            )}
            {showNote && q.type !== 'text' && (
              <p className="elig-note elig-warn">⚠️ {status.note}</p>
            )}
            {q.type === 'checkbox' &&
              (answers[q.id] ?? [])
                .map((v) => q.options.find((o) => o.value === v))
                .filter((o) => o?.status === 'warn' && o.note)
                .map((o) => (
                  <p key={o.value} className="elig-note elig-warn">
                    ⚠️ {o.note}
                  </p>
                ))}

            {q.ref && <p className="elig-ref">{q.ref}</p>}
          </fieldset>
        )
      })}
    </>
  )
}
