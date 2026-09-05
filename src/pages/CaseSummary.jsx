import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'
import { buildCaseFacts } from '../data/caseFacts.js'
import { deleteDocument, listDocuments, putDocument } from '../data/documentStore.js'
import { extractText } from '../data/extractText.js'

const formatChars = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k characters` : `${n} characters`)

// Quotes are checked against the source text server-side, so a citation
// either matches the document or is shown as needing manual checking.
function Citations({ items }) {
  if (!items?.length) return null
  return (
    <ul className="citation-list">
      {items.map((c, i) => (
        <li key={i} className={`citation ${c.verified ? 'ok' : 'unverified'}`}>
          <p className="citation-quote">&ldquo;{c.quote}&rdquo;</p>
          <p className="muted small">
            {c.documentName}
            {c.pinpoint && <> · {c.pinpoint}</>} ·{' '}
            {c.verified ? (
              <span className="citation-flag ok">✓ found in document</span>
            ) : (
              <span className="citation-flag bad">⚠ not found — check this quote yourself</span>
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}

function formatGeneratedAt(iso) {
  return new Date(iso).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })
}

// Cross-reference badges. L-refs link straight to the cited source; S/W
// refs jump to that item on the page.
function Related({ items, lawByIndex }) {
  if (!items?.length) return null
  return (
    <span className="idx-refs">
      {items.map((r) => {
        const law = r[0] === 'L' ? lawByIndex[r] : null
        return law ? (
          <a
            key={r}
            className="idx idx-L"
            href={law.source.url}
            target="_blank"
            rel="noreferrer"
            title={`${law.title} — ${law.source.label}${
              (law.provisions ?? []).length ? `, ${law.provisions.join(', ')}` : ''
            }`}
          >
            {r}
          </a>
        ) : (
          <a key={r} className={`idx idx-${r[0]}`} href={`#${r}`}>
            {r}
          </a>
        )
      })}
    </span>
  )
}

// Case summary asks the model for an indexed digest of the claimant's own
// facts: the law that bears on the claim (from a fixed allow-list of
// sources), the strongest points, the weaknesses, and which sources to
// read. The result is stored on the case so it survives navigation and
// logout; Regenerate replaces it. See server/index.js for the model call.
export default function CaseSummary({ caseData }) {
  const { updateCase } = useCase()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [error, setError] = useState('')
  const [docs, setDocs] = useState([])
  const [reading, setReading] = useState(false)
  const [docError, setDocError] = useState('')

  const summary = caseData.caseSummary
  const lawByIndex = Object.fromEntries((summary?.law ?? []).map((l) => [l.index, l]))

  useEffect(() => {
    listDocuments(caseData.id).then(setDocs).catch(() => setDocError('Could not open the document store.'))
  }, [caseData.id])

  async function addDocuments(fileList) {
    setDocError('')
    setReading(true)
    const failures = []
    for (const file of Array.from(fileList)) {
      try {
        const text = await extractText(file)
        await putDocument({
          id: `${caseData.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          caseId: caseData.id,
          name: file.name,
          chars: text.length,
          addedAt: new Date().toISOString(),
          text,
        })
      } catch (err) {
        failures.push(`${file.name}: ${err.message}`)
      }
    }
    setDocs(await listDocuments(caseData.id))
    setReading(false)
    if (failures.length) setDocError(failures.join(' · '))
  }

  async function removeDocument(id) {
    await deleteDocument(id)
    setDocs(await listDocuments(caseData.id))
  }

  async function generate() {
    setStatus('loading')
    setError('')
    try {
      const stored = await listDocuments(caseData.id)
      const res = await fetch('/api/case-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFacts: buildCaseFacts(caseData),
          documents: stored.map((d) => ({ name: d.name, text: d.text })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setStatus('error')
        return
      }
      updateCase(caseData.id, { caseSummary: { ...data, generatedAt: new Date().toISOString() } })
      setStatus('idle')
    } catch {
      setError('Could not reach the TribUnal server. Is it running (npm run dev:full)?')
      setStatus('error')
    }
  }

  if (!caseData.intakeAnswers) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Case summary</h2>
        </div>
        <p className="muted">
          The summary is built from your intake answers, so there is nothing to summarise yet.
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/intake?case=${caseData.id}`)}>
            Start intake
          </button>
        </div>
      </section>
    )
  }

  const loading = status === 'loading'

  return (
    <section className="card">
      <div className="card-head">
        <h2>Case summary</h2>
        <span className="card-head-right">
          {summary && <span className="muted small">Generated {formatGeneratedAt(summary.generatedAt)}</span>}
          <button type="button" className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>
            {loading ? 'Generating…' : summary ? 'Regenerate' : 'Generate summary'}
          </button>
        </span>
      </div>
      <p className="muted small">
        An AI digest of what you have told TribUnal so far: the rules that bear on your claim, where your
        account is strongest, where it is thin, and which official sources to read. It works only from your
        own answers and timeline — it does not know anything you have not entered.
      </p>

      <div className="doc-panel">
        <div className="doc-panel-head">
          <div>
            <strong className="small">Source documents</strong>
            <p className="muted small">
              Judgments, statutes, contracts or correspondence you have downloaded. The summary quotes from
              these and every quote is checked against the file. PDFs and text files; scanned images cannot
              be read.
            </p>
          </div>
          <label className="btn btn-outline btn-sm btn-upload">
            {reading ? 'Reading…' : 'Add documents'}
            <input
              type="file"
              multiple
              hidden
              disabled={reading}
              onChange={(e) => {
                addDocuments(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>

        {docError && <div className="form-error">{docError}</div>}

        {docs.length === 0 ? (
          <p className="muted small">No documents added yet.</p>
        ) : (
          <ul className="upload-list">
            {docs.map((d, i) => (
              <li key={d.id}>
                <span className="idx idx-D">D{i + 1}</span>
                <span className="upload-name">{d.name}</span>
                <span className="muted small">{formatChars(d.chars)}</span>
                <button
                  type="button"
                  className="upload-remove"
                  aria-label={`Remove ${d.name}`}
                  onClick={() => removeDocument(d.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {!summary && !loading && (
        <p className="muted small">Nothing generated yet. Press &ldquo;Generate summary&rdquo; to start.</p>
      )}

      {summary && (
        <div className="reality-results summary-results">
          <div className="reality-note">{summary.overallNote}</div>

          <h3>Relevant law</h3>
          {summary.law.length === 0 ? (
            <p className="muted small">No specific rules identified.</p>
          ) : (
            <ol className="summary-list-idx">
              {summary.law.map((l) => (
                <li key={l.index} id={l.index} className="summary-item">
                  <a className="idx idx-L" href={l.source.url} target="_blank" rel="noreferrer" title={l.source.label}>
                    {l.index}
                  </a>
                  <div>
                    <div className="summary-item-title">{l.title}</div>
                    <p className="small">{l.summary}</p>
                    {l.relevance && (
                      <p className="small">
                        <strong>Why it matters here:</strong> {l.relevance}
                      </p>
                    )}
                    <p className="muted small">
                      <a href={l.source.url} target="_blank" rel="noreferrer">
                        {l.source.label}
                      </a>
                      {(l.provisions ?? []).length > 0 && <> · {l.provisions.join(', ')}</>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="muted small law-disclaimer">
            This list is non-exhaustive. Please note that there may be more statutory provisions that may
            affect your case.
          </p>
          <p className="muted small">
            To read a statute in full, search its title on{' '}
            <a href="https://sso.agc.gov.sg/" target="_blank" rel="noreferrer">
              Singapore Statutes Online
            </a>
            , open it, and download it. Repeat for each statute above.
          </p>

          <h3>Strongest arguments</h3>
          {summary.strengths.length === 0 ? (
            <p className="muted small">No clearly supported points yet — see the weaknesses below.</p>
          ) : (
            <ol className="summary-list-idx">
              {summary.strengths.map((s) => (
                <li key={s.index} id={s.index} className="summary-item">
                  <span className="idx idx-S">{s.index}</span>
                  <div>
                    <div className="summary-item-title">
                      {s.point} <Related items={s.related} lawByIndex={lawByIndex} />
                    </div>
                    <p className="muted small">Based on: {s.basis}</p>
                    <Citations items={s.citations} />
                  </div>
                </li>
              ))}
            </ol>
          )}

          <h3>Weaknesses</h3>
          {summary.weaknesses.length === 0 ? (
            <p className="muted small">No gaps identified. Treat that with suspicion and re-read your answers.</p>
          ) : (
            <ol className="summary-list-idx">
              {summary.weaknesses.map((w) => (
                <li key={w.index} id={w.index} className="summary-item">
                  <span className="idx idx-W">{w.index}</span>
                  <div>
                    <div className="summary-item-title">
                      {w.point} <Related items={w.related} lawByIndex={lawByIndex} />
                    </div>
                    <p className="small">{w.why}</p>
                    <p className="muted small">What would address it: {w.evidenceNeeded}</p>
                    <Citations items={w.citations} />
                  </div>
                </li>
              ))}
            </ol>
          )}

          <h3>Case searches</h3>
          <p className="muted small">
            Run these on the{' '}
            <a
              href="https://www.judiciary.gov.sg/judgments/judgments-case-summaries"
              target="_blank"
              rel="noreferrer"
            >
              Singapore Judiciary judgments search
            </a>
            , broadest first. Open at least the top five results for each, and download the most recent ones —
            then add them under Source documents above and regenerate, so the summary can quote them.
          </p>
          {(summary.searches ?? []).length === 0 ? (
            <p className="muted small">No searches suggested.</p>
          ) : (
            <ol className="summary-list-idx">
              {summary.searches.map((s) => (
                <li key={s.index} className="summary-item">
                  <span className="idx idx-Q">{s.index}</span>
                  <div>
                    <div className="search-row">
                      <code className="search-query">{s.query}</code>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => navigator.clipboard?.writeText(s.query)}
                      >
                        Copy
                      </button>
                    </div>
                    <p className="small">{s.explanation}</p>
                    <p className="muted small">
                      <span className={`pill pill-scope-${s.scope}`}>{s.scope}</span>{' '}
                      <Related items={s.addresses} lawByIndex={lawByIndex} />
                    </p>
                    {s.problem && (
                      <p className="small citation-flag bad">
                        ⚠ Check this search before running it: {s.problem}.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          <h3>Relevant links</h3>
          {summary.links.length === 0 ? (
            <p className="muted small">No sources flagged as relevant.</p>
          ) : (
            <ul className="summary-list-idx">
              {summary.links.map((l) => (
                <li key={l.id} className="summary-item">
                  <span className="idx idx-link">¶</span>
                  <div>
                    <div className="summary-item-title">
                      <a href={l.url} target="_blank" rel="noreferrer">
                        {l.label}
                      </a>{' '}
                      <Related items={l.related} lawByIndex={lawByIndex} />
                    </div>
                    <p className="muted small">{l.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="muted small summary-disclaimer">
            This summary is generated from your own answers and is not legal advice. Section numbers are only
            shown where the model was confident; verify every reference against the linked source before
            relying on it.
          </p>
        </div>
      )}
    </section>
  )
}
