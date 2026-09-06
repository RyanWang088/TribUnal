// Active verification of citations.
//
// The server deletes citations it can prove wrong: a quote that does not
// appear in the document it names is removed, and any point left without a
// citation goes with it. What survives that is only "not provably false" —
// it is not yet checked by a human. A section number can be well-formed,
// point at a real statute, and still not say what the summary claims.
//
// So nothing reaches an export on the model's word. Each citation carries two
// questions the claimant answers themselves, after opening the source from
// the interface:
//
//   1. Does the citation exist?
//   2. Does this accurately reflect the substance of the citation?
//
// Both must be ticked before the citation is exportable. Unverified citations
// are stripped from the export, not flagged in it — a warning label in a
// document that leaves this app is a disclaimer, and disclaimers get ignored.

export const VERIFICATION_QUESTIONS = [
  { id: 'exists', text: 'Does the citation exist?' },
  { id: 'substance', text: 'Does this accurately reflect the substance of the citation?' },
]

// Content-addressed so a citation keeps its tick when a regenerated summary
// produces the same citation again, and loses it the moment the wording
// changes. djb2 — this identifies a string, it does not secure anything.
function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function documentCitationKey(citation) {
  return `d:${hash([citation.document, citation.quote, citation.pinpoint].join('|'))}`
}

export function lawCitationKey(law) {
  return `l:${hash([law.source?.id, ...(law.provisions ?? [])].join('|'))}`
}

export function isVerified(checks, key) {
  const check = checks?.[key]
  return Boolean(check && VERIFICATION_QUESTIONS.every((q) => check[q.id]))
}

// Every citation in the summary, law entries included, with the key its
// verification is stored under. One list so the counts and the export filter
// cannot drift apart.
export function allCitations(summary) {
  if (!summary) return []
  const out = []
  for (const law of summary.law ?? []) {
    out.push({ kind: 'law', key: lawCitationKey(law), owner: law.index })
  }
  for (const item of [...(summary.strengths ?? []), ...(summary.weaknesses ?? [])]) {
    for (const c of item.citations ?? []) {
      out.push({ kind: 'document', key: documentCitationKey(c), owner: item.index })
    }
  }
  return out
}

export function verificationCounts(summary, checks) {
  const all = allCitations(summary)
  const verified = all.filter((c) => isVerified(checks, c.key)).length
  return { total: all.length, verified, unverified: all.length - verified }
}

// What an export is allowed to contain. Citations the claimant has not
// verified are removed; a law entry keeps its explanation but loses the
// provision numbers, and a point that had citations and now has none is
// dropped entirely, exactly as the server does with false positives.
export function exportableSummary(summary, checks) {
  if (!summary) return null
  const law = (summary.law ?? []).map((l) => {
    if (isVerified(checks, lawCitationKey(l))) return l
    return { ...l, provisions: [], provisionsStripped: (l.provisions ?? []).length > 0, unverified: true }
  })
  const filterItems = (items) =>
    (items ?? [])
      .map((item) => {
        const kept = (item.citations ?? []).filter((c) => isVerified(checks, documentCitationKey(c)))
        return { ...item, citations: kept, citationsStripped: (item.citations ?? []).length - kept.length }
      })
      .filter((item) => (item.citations ?? []).length > 0 || item.citationsStripped === 0)
  return {
    ...summary,
    law,
    strengths: filterItems(summary.strengths),
    weaknesses: filterItems(summary.weaknesses),
  }
}
