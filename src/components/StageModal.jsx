import { useEffect, useRef } from 'react'
import { countdownLabel, isStageComplete, stageById } from '../data/stages.js'

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Popup for one stage of the process: what the stage is, the checklist for
// it, and its date. Ticking every box completes the stage, which is what
// moves the case on to the next one (see currentStageOf in caseEvents.js).
export default function StageModal({ stageId, progress, date, onToggle, onSetDate, onSkip, onClose }) {
  const stage = stageById(stageId)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!stage) return null

  const done = progress?.[stageId] ?? {}
  const complete = isStageComplete(progress, stageId)
  const skipped = Boolean(done.skipped)
  const countdown = stage.dateKind ? countdownLabel(stage.dateKind, date) : null
  const dateHeading = stage.dateKind === 'due' ? 'Due' : 'Date'

  return (
    <div
      className="stage-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="stage-modal">
        <div className="stage-modal-head">
          <span className={`stage-modal-num ${complete ? 'done' : ''}`}>{stage.id}</span>
          <h2 id="stage-modal-title">{stage.label}</h2>
          <button ref={closeRef} type="button" className="stage-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="stage-modal-body">
          <h3 className="stage-modal-sub">What is this?</h3>
          <p className="stage-modal-what">{stage.what}</p>

          <h3 className="stage-modal-sub">What you need to do</h3>
          <ul className="stage-tasks">
            {stage.tasks.map((t) => (
              <li key={t.id}>
                <label className={done[t.id] ? 'checked' : ''}>
                  <input
                    type="checkbox"
                    checked={Boolean(done[t.id])}
                    disabled={skipped}
                    onChange={() => onToggle(stage.id, t.id)}
                  />
                  <span>{t.label}</span>
                </label>
              </li>
            ))}
          </ul>

          {stage.dateKind && (
            <div className="stage-date">
              <div className="stage-date-row">
                <span className="stage-date-label">{dateHeading}:</span>
                {date ? (
                  <strong>{formatDate(date)}</strong>
                ) : (
                  <span className="muted">
                    {stage.dateOptional ? 'Not applicable yet' : 'Not set yet'}
                  </span>
                )}
                {countdown && <span className="stage-countdown">{countdown}</span>}
              </div>
              <label className="stage-date-edit">
                <span>Set date</span>
                <input
                  type="date"
                  value={date ?? ''}
                  onChange={(e) => onSetDate(stage.id, e.target.value || null)}
                />
              </label>
            </div>
          )}
        </div>

        <div className="stage-modal-foot">
          {stage.next && (
            <div className="stage-next">
              <span className="muted small">{stage.nextIntro}</span>
              <strong>→ Next: {stage.next}</strong>
            </div>
          )}
          {stage.optional && !complete && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onSkip(stage.id)}>
              {stage.skipLabel}
            </button>
          )}
          {skipped && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onSkip(stage.id)}>
              Undo skip
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
