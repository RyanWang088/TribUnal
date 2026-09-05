import { useState } from 'react'

const DATE_TYPES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'hearing', label: 'Hearing' },
  { value: 'deadline', label: 'Deadline' },
]

export default function SuperCaseForm({ caseData, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState({
    ref: caseData.ref,
    title: caseData.title,
    claimType: caseData.claimType,
    respondent: caseData.respondent,
    amount: caseData.amount,
    summary: caseData.summary ?? '',
    upcomingDates: caseData.upcomingDates ?? [],
  })

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function setDate(index, key, value) {
    setForm((f) => ({
      ...f,
      upcomingDates: f.upcomingDates.map((d, i) => (i === index ? { ...d, [key]: value } : d)),
    }))
  }

  function addDate() {
    setForm((f) => ({
      ...f,
      upcomingDates: [...f.upcomingDates, { date: '', label: '', type: 'consultation' }],
    }))
  }

  function removeDate(index) {
    setForm((f) => ({ ...f, upcomingDates: f.upcomingDates.filter((_, i) => i !== index) }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      ref: form.ref.trim(),
      title: form.title.trim(),
      claimType: form.claimType.trim(),
      respondent: form.respondent.trim(),
      amount: Number(form.amount) || 0,
      summary: form.summary.trim(),
      upcomingDates: form.upcomingDates.filter((d) => d.date && d.label.trim()),
    })
  }

  return (
    <form className="super-form" onSubmit={handleSubmit}>
      <div className="super-form-row">
        <label>
          Case ref
          <input type="text" value={form.ref} onChange={set('ref')} required />
        </label>
        <label>
          Amount (S$)
          <input type="number" min="0" value={form.amount} onChange={set('amount')} />
        </label>
      </div>
      <label>
        Title
        <input type="text" value={form.title} onChange={set('title')} required />
      </label>
      <label>
        Claim type
        <input type="text" value={form.claimType} onChange={set('claimType')} />
      </label>
      <label>
        Respondent
        <input type="text" value={form.respondent} onChange={set('respondent')} />
      </label>
      <label>
        Summary
        <textarea rows={3} value={form.summary} onChange={set('summary')} placeholder="Shown under Relevant summaries" />
      </label>

      <div className="super-dates">
        <div className="super-dates-head">
          <span>Upcoming key dates</span>
          <button type="button" className="btn-link" onClick={addDate}>
            + Add date
          </button>
        </div>
        {form.upcomingDates.map((d, i) => (
          <div key={i} className="super-form-row super-date-row">
            <input type="date" value={d.date} onChange={(e) => setDate(i, 'date', e.target.value)} />
            <input
              type="text"
              value={d.label}
              placeholder="Label"
              onChange={(e) => setDate(i, 'label', e.target.value)}
            />
            <select value={d.type} onChange={(e) => setDate(i, 'type', e.target.value)}>
              {DATE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={() => removeDate(i)}>
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="super-actions">
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={onDelete}>
            Delete case
          </button>
        )}
      </div>
    </form>
  )
}
