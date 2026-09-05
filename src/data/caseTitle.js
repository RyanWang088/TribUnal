export const PLACEHOLDER_TITLE = 'New matter'

// Asks the model for a short neutral title (and the respondent's name, if
// the claimant stated one). Best-effort: any failure returns null so the
// caller keeps whatever title it already has rather than blocking.
export async function suggestTitle(sourceFacts) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch('/api/case-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFacts }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = await res.json()
    return { title: data.title || '', respondent: data.respondent || '' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
