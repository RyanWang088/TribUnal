import { useMemo, useState } from 'react'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_FMT = { month: 'long', year: 'numeric' }

function pad(n) {
  return String(n).padStart(2, '0')
}

function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Builds a 6-row month grid starting on Monday, including the leading and
// trailing days from adjacent months so every row is full.
function buildGrid(year, month) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7 // Monday = 0
  const gridStart = new Date(year, month, 1 - startOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

// `items`: [{ date: 'YYYY-MM-DD', label, type, caseId, caseRef, caseTitle }]
export default function CaseCalendar({ items, onSelectCase }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const byDate = useMemo(() => {
    const map = {}
    items.forEach((item) => {
      ;(map[item.date] ??= []).push(item)
    })
    return map
  }, [items])

  const grid = useMemo(() => buildGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const todayISO = toISO(new Date())

  const upcoming = useMemo(
    () =>
      [...items]
        .filter((item) => item.date >= todayISO)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(0, 6),
    [items, todayISO],
  )

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <h3>{cursor.toLocaleDateString('en-SG', MONTH_FMT)}</h3>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          ›
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}
        {grid.map((date) => {
          const iso = toISO(date)
          const inMonth = date.getMonth() === cursor.getMonth()
          const dayItems = byDate[iso] ?? []
          return (
            <div
              key={iso}
              className={`calendar-cell ${inMonth ? '' : 'out'} ${iso === todayISO ? 'today' : ''}`}
            >
              <span className="calendar-daynum">{date.getDate()}</span>
              {dayItems.length > 0 && (
                <div className="calendar-dots">
                  {dayItems.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`calendar-dot dot-${item.type}`}
                      title={`${item.caseRef} · ${item.label}`}
                      onClick={() => onSelectCase?.(item.caseId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="calendar-agenda">
        <h4>Upcoming key dates</h4>
        {upcoming.length === 0 ? (
          <p className="muted small">No upcoming key dates across your cases.</p>
        ) : (
          <ul className="plain-list">
            {upcoming.map((item, i) => (
              <li key={i}>
                <span className={`pill pill-${item.type === 'hearing' ? 'respondent' : 'court'}`}>
                  {new Date(item.date + 'T00:00:00').toLocaleDateString('en-SG', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <button type="button" className="btn-link" onClick={() => onSelectCase?.(item.caseId)}>
                  {item.caseRef} · {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
