import { useEffect, useRef, useState } from 'react'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const YEARS_PER_PAGE = 12

const pad = (n) => String(n).padStart(2, '0')
const toDMY = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`

function fromDMY(text) {
  const m = String(text ?? '').match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return d.getDate() === Number(m[1]) ? d : null
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Calendar dropdown that stores its value as dd/mm/yyyy. Two levels only:
// day grid, and (on clicking the month heading) a year grid. Future dates
// are not selectable.
export default function DatePicker({ id, value, onChange, placeholder }) {
  const selected = fromDMY(value)
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('days')
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [yearStart, setYearStart] = useState(() => cursor.getFullYear() - YEARS_PER_PAGE + 1)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function openPicker() {
    const base = selected ?? today
    setCursor(new Date(base.getFullYear(), base.getMonth(), 1))
    setView('days')
    setOpen(true)
  }

  function shiftMonth(delta) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  function showYears() {
    setYearStart(cursor.getFullYear() - YEARS_PER_PAGE + 1)
    setView('years')
  }

  function pickYear(year) {
    setCursor((c) => new Date(year, c.getMonth(), 1))
    setView('days')
  }

  function pickDay(date) {
    onChange(toDMY(date))
    setOpen(false)
  }

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstOffset + 1
    return dayNum >= 1 && dayNum <= daysInMonth ? new Date(year, month, dayNum) : null
  })
  const nextMonthDisabled = year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth())
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearStart + i)

  return (
    <div className="datepicker" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`datepicker-input ${selected ? '' : 'placeholder'}`}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{selected ? toDMY(selected) : placeholder}</span>
        <span className="datepicker-icon" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="datepicker-pop" role="dialog">
          {view === 'days' ? (
            <>
              <div className="datepicker-head">
                <button type="button" className="datepicker-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                  ‹
                </button>
                <button type="button" className="datepicker-title" onClick={showYears}>
                  {MONTHS[month]} {year}
                </button>
                <button
                  type="button"
                  className="datepicker-nav"
                  onClick={() => shiftMonth(1)}
                  disabled={nextMonthDisabled}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
              <div className="datepicker-grid">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="datepicker-weekday">
                    {d}
                  </div>
                ))}
                {cells.map((date, i) =>
                  date ? (
                    <button
                      key={i}
                      type="button"
                      className={`datepicker-day ${sameDay(date, selected) ? 'selected' : ''} ${
                        sameDay(date, today) ? 'today' : ''
                      }`}
                      disabled={date > today}
                      onClick={() => pickDay(date)}
                    >
                      {date.getDate()}
                    </button>
                  ) : (
                    <div key={i} />
                  ),
                )}
              </div>
            </>
          ) : (
            <>
              <div className="datepicker-head">
                <button
                  type="button"
                  className="datepicker-nav"
                  onClick={() => setYearStart((y) => y - YEARS_PER_PAGE)}
                  aria-label="Earlier years"
                >
                  ‹
                </button>
                <span className="datepicker-title static">
                  {years[0]} – {years[years.length - 1]}
                </span>
                <button
                  type="button"
                  className="datepicker-nav"
                  onClick={() => setYearStart((y) => y + YEARS_PER_PAGE)}
                  disabled={years[years.length - 1] >= today.getFullYear()}
                  aria-label="Later years"
                >
                  ›
                </button>
              </div>
              <div className="datepicker-years">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`datepicker-year ${y === year ? 'selected' : ''}`}
                    disabled={y > today.getFullYear()}
                    onClick={() => pickYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
