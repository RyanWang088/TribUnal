import { useState } from 'react'
import { stages } from '../data/caseEvents.js'

const today = () => new Date().toISOString().slice(0, 10)

const EVENT_TYPES = [
  { value: 'user', label: 'You' },
  { value: 'court', label: 'Court' },
  { value: 'respondent', label: 'Respondent' },
  { value: 'system', label: 'TribUnal' },
]

export default function SuperEventForm({ initial, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState({
    date: initial?.date ?? today(),
    stage: initial?.stage ?? 0,
    type: initial?.type ?? 'court',
    title: initial?.title ?? '',
    detail: initial?.detail ?? '',
  })

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({ ...form, stage: Number(form.stage), title: form.title.trim(), detail: form.detail.trim() })
  }

  return (
    <form className="super-form" onSubmit={handleSubmit}>
      <div className="super-form-row">
        <label>
          Date
          <input type="date" value={form.date} onChange={set('date')} required />
        </label>
        <label>
          Stage
          <select value={form.stage} onChange={set('stage')}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <select value={form.type} onChange={set('type')}>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Title
        <input type="text" value={form.title} onChange={set('title')} required />
      </label>
      <label>
        Detail
        <textarea rows={3} value={form.detail} onChange={set('detail')} />
      </label>
      <div className="super-actions">
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button type="button" className="btn btn-outline btn-sm btn-danger" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </form>
  )
}
