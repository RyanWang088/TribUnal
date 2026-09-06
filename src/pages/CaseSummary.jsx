import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'
import { buildCaseFacts } from '../data/caseFacts.js'
import { deleteDocument, listDocuments, putDocument } from '../data/documentStore.js'
import { extractText } from '../data/extractText.js'
import {
  VERIFICATION_QUESTIONS,
  documentCitationKey,
  isVerified,
  lawCitationKey,
  verificationCounts,
} from '../data/citations.js'

const formatChars = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k characters` : `${n} characters`)

// Summaries are point form. Older stored summaries kept them as a single
// string, so both shapes render.
function Points({ value, className = 'small' }) {
  const items = Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []
  if (items.length === 0) return null
  return (
    <ul className={`point-list ${className}`}>
      {items.map((t, i) => (
        <li key={i}>{typeof t === 'string' ? t : t.text}</li>
      ))}
    </ul>
  )
}

// How to actually check a citation, spelled out rather than assumed. The
// claimant is being asked to attest to something, so they are told what the
// attestation involves: open the source, find the provision or paragraph,
// read it. `searchText` and `caseCitation` fill the placeholders.
function VerifySteps({ searchText, caseCitation }) {
  return (
    <div className="verify-steps">
      <p className="verify-steps-head">Please check the following:</p>
      <p className="verify-steps-kind">Statute</p>
      <ol>
        <li>
          Search &ldquo;<span className="verify-token">{searchText}</span>&rdquo; on your browser
        </li>
        <li>Open the statute</li>
        <li>Locate the section</li>
      </ol>
      <p className="verify-steps-kind">Cases:</p>
      <ol>
        <li>Open database</li>
        <li>
          Paste{' '}
          {caseCitation ? (
            <>
              &ldquo;<span className="verify-token">{caseCitation}</span>&rdquo;
            </>
          ) : (
            <>
              a citation in the form{' '}
              <span className="verify-token verify-token-empty">[Year] Volume ReportSeries</span>
            </>
          )}{' '}
          into the database
        </li>
        <li>Find open the case</li>
        <li>Find the paragraph with the corresponding number</li>
      </ol>
    </div>
  )
}

// The two questions the claimant answers for themselves. Both must be ticked
// before the citation can leave the app in an export — see data/citations.js.
function VerifyGate({ citationKey, checks, onCheck, openLabel, onOpen, href, searchText, caseCitation }) {
  const verified = isVerified(checks, citationKey)
  return (
    <div className={`verify ${verified ? 'verified' : ''}`}>
      <div className="verify-head">
        <span className="verify-status">
          {verified ? '✓ Verified by you — will be included in exports' : 'Not verified'}
        </span>
        {href ? (
          <a className="btn-link" href={href} target="_blank" rel="noreferrer">
            {openLabel} ↗
          </a>
        ) : (
          <button type="button" className="btn-link" onClick={onOpen}>
            {openLabel} ↗
          </button>
        )}
      </div>
      <VerifySteps searchText={searchText} caseCitation={caseCitation} />
      {VERIFICATION_QUESTIONS.map((q) => (
        <label key={q.id} className="verify-q">
          <input
            type="checkbox"
            checked={Boolean(checks?.[citationKey]?.[q.id])}
            onChange={(e) => onCheck(citationKey, q.id, e.target.checked)}
          />
          <span>{q.text}</span>
        </label>
      ))}
    </div>
  )
}

// Every supporting argument is a dotpoint carrying its own pinpoint reference
// and its own quotations, each of which has to be verified before it can be
// exported. Older stored summaries kept plain strings here.
function Dotpoints({ items, checks, onCheck, onOpenDocument }) {
  // Summaries stored before dotpoints existed kept a single string here, and
  // an API server still running the old code returns one too — normalise
  // rather than assume an array, or the whole summary fails to render.
  const list = (Array.isArray(items) ? items : items ? [items] : []).filter(Boolean)
  if (list.length === 0) return null
  return (
    <ul className="dotpoint-list">
      {list.map((d, i) =>
        typeof d === 'string' ? (
          <li key={i} className="dotpoint">
            {d}
          </li>
        ) : (
          <li key={i} className="dotpoint">
            <span className="dotpoint-text">{d.text}</span>
            {d.authority && <span className="dotpoint-authority">{d.authority}</span>}
            <Citations
              items={d.citations}
              checks={checks}
              onCheck={onCheck}
              onOpenDocument={onOpenDocument}
            />
          </li>
        ),
      )}
    </ul>
  )
}

// Quotes that did not appear in the document they named have already been
// deleted server-side, along with any point left unsupported by their
// removal. What is left still has to be checked by the claimant before it can
// be exported.
function Citations({ items, checks, onCheck, onOpenDocument }) {
  if (!items?.length) return null
  return (
    <ul className="citation-list">
      {items.map((c, i) => {
        const key = documentCitationKey(c)
        return (
          <li key={i} className={`citation ${isVerified(checks, key) ? 'ok' : 'unverified'}`}>
            <p className="citation-quote">&ldquo;{c.quote}&rdquo;</p>
            <p className="muted small">
              {c.documentName}
              {c.pinpoint && <> · {c.pinpoint}</>}
            </p>
            <VerifyGate
              citationKey={key}
              checks={checks}
              onCheck={onCheck}
              openLabel={`Open ${c.documentName}`}
              onOpen={() => onOpenDocument(c.document)}
              searchText={c.pinpoint ? `${c.documentName} ${c.pinpoint}` : c.documentName}
              caseCitation=""
            />
          </li>
        )
      })}
    </ul>
  )
}

// The download and upload walkthroughs are fixed steps, so they are written
// here rather than asked of the model: they are the same for every case, and
// a step the model paraphrased differently each time would be worse.
function HowTo({ title, steps }) {
  return (
    <div className="howto">
      <h3>{title}</h3>
      <ol className="howto-steps">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
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
  const { updateCase, setCitationCheck } = useCase()
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [error, setError] = useState('')
  const [docs, setDocs] = useState([])
  const [reading, setReading] = useState(false)
  const [docError, setDocError] = useState('')

  const summary = caseData.caseSummary
  const checks = caseData.citationChecks ?? {}
  const counts = verificationCounts(summary, checks)

  // Verification has to be done against the source, not from memory, so the
  // document is opened from here. Documents live in IndexedDB as extracted
  // text, so the tab shows that text for the claimant to search.
  async function openDocument(dLabel) {
    const stored = await listDocuments(caseData.id)
    const i = Number(String(dLabel).slice(1)) - 1
    const doc = stored[i]
    if (!doc) return
    const url = URL.createObjectURL(new Blob([doc.text], { type: 'text/plain;charset=utf-8' }))
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
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

          {summary.integrity && (
            <p className="muted small integrity-note">
              Checked {summary.integrity.citationsChecked} quotation
              {summary.integrity.citationsChecked === 1 ? '' : 's'} against your documents.
              {summary.integrity.citationsDeleted > 0 && (
                <> Deleted {summary.integrity.citationsDeleted} that did not appear in the document named.</>
              )}
              {summary.integrity.pointsDeleted > 0 && (
                <> Removed {summary.integrity.pointsDeleted} point
                  {summary.integrity.pointsDeleted === 1 ? '' : 's'} left with no citation behind
                  {summary.integrity.pointsDeleted === 1 ? ' it' : ' them'}.</>
              )}
              {summary.integrity.provisionsDeleted > 0 && (
                <> Dropped {summary.integrity.provisionsDeleted} malformed provision reference
                  {summary.integrity.provisionsDeleted === 1 ? '' : 's'}.</>
              )}
              {summary.integrity.caseCitationsDeleted > 0 && (
                <> Dropped {summary.integrity.caseCitationsDeleted} malformed case citation
                  {summary.integrity.caseCitationsDeleted === 1 ? '' : 's'}.</>
              )}
            </p>
          )}

          {counts.total > 0 && (
            <div className={`export-gate ${counts.unverified === 0 ? 'ready' : ''}`}>
              <strong>
                {counts.verified} of {counts.total} citations verified by you
              </strong>
              <p className="small">
                {counts.unverified === 0
                  ? 'Every citation has been checked against its source. All of them would be included in an export.'
                  : 'Open each source below and answer both questions before relying on it.'}
              </p>
            </div>
          )}

          <h3>Statute Searches</h3>
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
                    <Points value={l.summaryPoints ?? l.summary} />
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
                    <VerifyGate
                      citationKey={lawCitationKey(l)}
                      checks={checks}
                      onCheck={(key, q, v) => setCitationCheck(caseData.id, key, q, v)}
                      openLabel="Open on SSO"
                      href={l.source.url}
                      searchText={`${l.source.label} ${(l.provisions ?? []).join(', ')}`.trim()}
                      caseCitation={l.caseCitation}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="muted small law-disclaimer">
            This list is non-exhaustive. Please note that there may be more statutory provisions that may
            affect your case.
          </p>

          <HowTo
            title="Downloading Statute"
            steps={[
              <>
                Go onto the Statutes Online website:{' '}
                <a href="https://sso.agc.gov.sg/" target="_blank" rel="noreferrer">
                  https://sso.agc.gov.sg/
                </a>
              </>,
              'For the first recommended statute, search the statute title in the search bar.',
              'Open the statute.',
              'Download the statute.',
              'Do this for all recommended statutes.',
            ]}
          />

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
                    <p className="muted small">Based on:</p>
                    <Dotpoints
                      items={s.dotpoints ?? s.basisPoints ?? s.basis}
                      checks={checks}
                      onCheck={(key, q, v) => setCitationCheck(caseData.id, key, q, v)}
                      onOpenDocument={openDocument}
                    />
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
                    <Dotpoints
                      items={w.dotpoints ?? w.whyPoints ?? w.why}
                      checks={checks}
                      onCheck={(key, q, v) => setCitationCheck(caseData.id, key, q, v)}
                      onOpenDocument={openDocument}
                    />
                    <p className="muted small">What would address it: {w.evidenceNeeded}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {summary.organisation && (
            <>
              <h3>Organisation</h3>
              <p className="muted small">
                <strong>{summary.organisation.approach}</strong> — {summary.organisation.rationale}
              </p>
              <ol className="summary-list-idx">
                {(summary.organisation.sections ?? []).map((sec, i) => (
                  <li key={i} className="summary-item">
                    <span className="idx idx-O">{i + 1}</span>
                    <div>
                      <div className="summary-item-title">
                        {sec.heading} <Related items={sec.related} lawByIndex={lawByIndex} />
                      </div>
                      <Dotpoints
                        items={sec.dotpoints ?? sec.points}
                        checks={checks}
                        onCheck={(key, q, v) => setCitationCheck(caseData.id, key, q, v)}
                        onOpenDocument={openDocument}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          <h3>Case Searches</h3>
          <p className="muted small">
            Run these on the{' '}
            <a
              href="https://www.judiciary.gov.sg/judgments/judgments-case-summaries"
              target="_blank"
              rel="noreferrer"
            >
              Singapore Judiciary judgments search
            </a>
            , broadest first.
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
                    {(s.controlF ?? []).length > 0 && (
                      <p className="muted small">
                        Control-F inside each judgment for:{' '}
                        {s.controlF.map((t, i) => (
                          <span key={i}>
                            {i > 0 && ', '}
                            <code className="ctrl-f">{t}</code>
                          </span>
                        ))}
                      </p>
                    )}
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

          <HowTo
            title="Downloading Case Law"
            steps={[
              <>
                Go onto the court registry:{' '}
                <a
                  href="https://www.judiciary.gov.sg/judgments/judgments-case-summaries"
                  target="_blank"
                  rel="noreferrer"
                >
                  https://www.judiciary.gov.sg/judgments/judgments-case-summaries
                </a>
              </>,
              'Enter the first search recommendation into the search bar.',
              'Open at least the top five cases.',
              'Export these five most recent cases to your local drive.',
              'Repeat this for each search recommendation.',
            ]}
          />

          <HowTo
            title="Next Steps"
            steps={[
              'Collect the statutes and judgments you downloaded into one folder.',
              'Scroll up to Source documents and add them there — PDFs and text files are read in full.',
              'Regenerate this summary so it can quote the documents you added.',
              'Work through each citation below and tick both verification questions once you have checked it against the source.',
            ]}
          />

          {(summary.digestPrompts ?? []).length > 0 && (
            <>
              <h4 className="subhead">Digesting a judgment with AI</h4>
              <p className="muted small">
                Paste one of these together with a judgment you downloaded. Each asks for something you can
                check against the text in front of you.
              </p>
              <ul className="digest-list">
                {summary.digestPrompts.map((t, i) => (
                  <li key={i}>
                    <code>{t}</code>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => navigator.clipboard?.writeText(t)}
                    >
                      Copy
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {(summary.furtherSources ?? []).length > 0 && (
            <>
              <h4 className="subhead">Further sources to obtain</h4>
              <ul className="summary-list-idx">
                {summary.furtherSources.map((f, i) => (
                  <li key={i} className="summary-item">
                    <span className="idx idx-link">+</span>
                    <div>
                      <div className="summary-item-title">
                        {f.what} <Related items={f.related} lawByIndex={lawByIndex} />
                      </div>
                      <p className="muted small">{f.why}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
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
