import { stages } from '../data/caseEvents.js'

const typeLabel = {
  user: 'You',
  court: 'Court',
  respondent: 'Respondent',
  system: 'TribUnal',
}

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Renders events newest-first. Re-renders automatically whenever the
// events array in CaseContext changes.
export default function Timeline({ events }) {
  // Newest first. Events sharing a date keep reverse insertion order so the
  // most recently added one sits at the top.
  const sorted = events
    .map((ev, index) => ({ ev, index }))
    .sort((a, b) => (a.ev.date === b.ev.date ? b.index - a.index : a.ev.date < b.ev.date ? 1 : -1))
    .map(({ ev }) => ev)

  return (
    <ol className="timeline">
      {sorted.map((ev, i) => (
        <li key={ev.id} className={`timeline-item type-${ev.type} ${i === 0 ? 'latest' : ''}`}>
          <div className="timeline-dot" />
          <div className="timeline-body">
            <div className="timeline-meta">
              <span className="timeline-date">{formatDate(ev.date)}</span>
              <span className={`pill pill-${ev.type}`}>{typeLabel[ev.type]}</span>
              <span className="pill pill-stage">
                Stage {ev.stage} · {stages[ev.stage].label}
              </span>
            </div>
            <div className="timeline-title">{ev.title}</div>
            <div className="timeline-detail">{ev.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}
