// Minimal backend for the AI features (Reality Check, Case summary). Its
// only job is to hold the OpenRouter API key server-side and forward
// structured model calls. Nothing else in TribUnal needs a backend yet —
// this exists purely so the key never ships inside the browser bundle.
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

dotenv.config({ path: new URL('.env', import.meta.url) })

const PORT = process.env.PORT || 8787
const apiKey = process.env.OPENROUTER_API_KEY
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-5'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// OpenRouter exposes an OpenAI-compatible API, so the same SDK works —
// it just needs to be pointed at OpenRouter's base URL.
const openai = apiKey
  ? new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })
  : null

const NO_KEY_ERROR =
  'OPENROUTER_API_KEY is not set. Add it to server/.env (see server/.env.example) and restart the server.'

// Forces the model to answer via a single tool call and returns the parsed
// arguments. Throws with a user-safe message if the model replies in prose
// or the arguments are not valid JSON, so callers can map it to a 502.
async function runStructured({ system, user, tool, maxTokens }) {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    tools: [{ type: 'function', function: tool }],
    tool_choice: { type: 'function', function: { name: tool.name } },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: typeof user === 'string' ? user : JSON.stringify(user) },
    ],
  })
  const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall) throw new Error('The model did not return a structured result. Try again.')
  try {
    return JSON.parse(toolCall.function.arguments)
  } catch {
    throw new Error('The model returned malformed output. Try again.')
  }
}

const REALITY_CHECK_TOOL = {
  name: 'report_reality_check',
  description: 'Report the fact-check and bias review of a claimant\'s draft statement.',
  parameters: {
    type: 'object',
    properties: {
      claims: {
        type: 'array',
        description: 'Every distinct factual claim found in the draft, in the order they appear.',
        items: {
          type: 'object',
          properties: {
            statement: { type: 'string', description: 'The claim, quoted or closely paraphrased from the draft.' },
            verdict: { type: 'string', enum: ['confirmed', 'needs_verification', 'unsupported'] },
            reason: {
              type: 'string',
              description: 'One sentence explaining the verdict, referencing the source facts or noting their absence.',
            },
          },
          required: ['statement', 'verdict', 'reason'],
        },
      },
      bias_flags: {
        type: 'array',
        description: 'One-sided framing, leading language, or unverified assumptions of fault found in the draft.',
        items: {
          type: 'object',
          properties: {
            issue: { type: 'string', description: "Short label, e.g. 'One-sided framing' or 'Assumes fault without evidence'." },
            quote: { type: 'string', description: 'The exact phrase from the draft that shows this.' },
            explanation: { type: 'string' },
          },
          required: ['issue', 'quote', 'explanation'],
        },
      },
      overall_note: {
        type: 'string',
        description: 'A short, neutral one or two sentence summary for the claimant. Never a legal conclusion.',
      },
    },
    required: ['claims', 'bias_flags', 'overall_note'],
  },
}

const SYSTEM_PROMPT = `You are the Reality Check layer inside TribUnal, a case-preparation tool for self-represented \
claimants in Singapore's Small Claims Tribunals. You are NOT a lawyer. You must never give legal advice, \
predict the outcome of a case, or state a legal conclusion as settled fact.

You will receive SOURCE FACTS (information the claimant confirmed themselves during intake) and a DRAFT \
(text the claimant is considering using — their own writing, or something a separate AI assistant produced \
for them). Your job:

1. Verify: break the draft into its individual factual claims. For each one, decide:
   - "confirmed": directly stated in the source facts.
   - "needs_verification": a plausible inference from the source facts, but not stated outright.
   - "unsupported": not found in the source facts at all. This includes anything that looks invented — \
fabricated dates, amounts, case law, legal authorities, or a legal conclusion dressed up as fact.
2. Flag bias: identify one-sided framing, leading language, assumptions of fault or intent presented \
without evidence, or overconfident conclusions presented as settled fact. Quote the exact phrase.

Never invent case law, statistics, or legal authorities yourself. Always call the report_reality_check \
tool with your findings — never reply in plain text.`

app.post('/api/reality-check', async (req, res) => {
  if (!openai) return res.status(503).json({ error: NO_KEY_ERROR })

  const { sourceFacts, draft } = req.body ?? {}
  if (!draft || !draft.trim()) {
    return res.status(400).json({ error: 'Missing "draft" text to check.' })
  }

  try {
    const result = await runStructured({
      system: SYSTEM_PROMPT,
      user: { sourceFacts: sourceFacts ?? {}, draft },
      tool: REALITY_CHECK_TOOL,
      maxTokens: 2000,
    })
    res.json(result)
  } catch (err) {
    console.error('Reality check request failed:', err)
    res.status(502).json({ error: err.message || 'Could not reach the model.' })
  }
})

// ---------------------------------------------------------------------------
// Case summary
// ---------------------------------------------------------------------------

// The only sources the model is allowed to cite. The tool schema constrains
// `source` to these ids, so a hallucinated statute or URL cannot reach the
// claimant — anything outside this list is dropped before the response is
// sent.
const SOURCES = [
  {
    id: 'SCTA1984',
    label: 'Small Claims Tribunals Act 1984',
    url: 'https://sso.agc.gov.sg/Act/SCTA1984',
    about: 'Jurisdiction of the SCT: what claims it can hear, the monetary limit, the 2-year time bar, and the orders it can make.',
  },
  {
    id: 'SCTA1984-R1',
    label: 'Small Claims Tribunals Rules',
    url: 'https://sso.agc.gov.sg/SL/SCTA1984-R1',
    about: 'Procedural rules under the Act: how claims are lodged, served and heard, fees and forms.',
  },
  {
    id: 'EPD-XIX',
    label: 'State Courts Practice Directions 2021, Part XIX (Community Courts and Tribunals Cluster)',
    url: 'https://epd2021-statecourts.judiciary.gov.sg/part-xix-proceedings-before-the-community-courts-and-tribunals-cluster',
    about: 'Practical directions for proceedings before the SCT: CJTS filing, consultations, hearings, documents and conduct.',
  },
  {
    id: 'CPFTA2003',
    label: 'Consumer Protection (Fair Trading) Act 2003',
    url: 'https://sso.agc.gov.sg/act/cpfta2003',
    about: 'Unfair practices by suppliers, consumer remedies, and (via regulations) motor vehicle dealer deposits.',
  },
  {
    id: 'CDRA2015',
    label: 'Community Disputes Resolution Act 2015',
    url: 'https://sso.agc.gov.sg/Act/CDRA2015',
    about: 'Neighbour disputes, which go to the Community Disputes Resolution Tribunals rather than the SCT.',
  },
  {
    id: 'ECA2016',
    label: 'Employment Claims Act 2016',
    url: 'https://sso.agc.gov.sg/Act/ECA2016',
    about: 'Salary and employment disputes, which go to the Employment Claims Tribunals rather than the SCT.',
  },
  {
    id: 'SCA1970',
    label: 'State Courts Act 1970',
    url: 'https://sso.agc.gov.sg/Act/SCA1970',
    about: 'Constitution and powers of the State Courts, including enforcement of tribunal orders.',
  },
]
const SOURCE_IDS = SOURCES.map((s) => s.id)
const sourceById = Object.fromEntries(SOURCES.map((s) => [s.id, s]))

// Documents the claimant uploaded, as D1, D2, … Text is capped so a long
// judgment cannot crowd out the rest of the request; the model is told when
// a document was cut short so it does not cite past the end of what it saw.
const DOC_CHAR_CAP = 60000
const DOC_TOTAL_CAP = 200000

function prepareDocuments(documents) {
  const out = []
  let budget = DOC_TOTAL_CAP
  for (const doc of (Array.isArray(documents) ? documents : [])) {
    const text = String(doc?.text ?? '')
    if (!text.trim() || budget <= 0) continue
    const cap = Math.min(DOC_CHAR_CAP, budget)
    const truncated = text.length > cap
    const body = truncated ? text.slice(0, cap) : text
    budget -= body.length
    out.push({
      index: `D${out.length + 1}`,
      name: String(doc?.name ?? 'Untitled document').slice(0, 200),
      truncated,
      text: body,
    })
  }
  return out
}

// eLitigation advanced-search operators, verbatim from the court's own
// guide. The model is given these and nothing else, so it cannot invent
// syntax the search box will reject.
const SEARCH_OPERATORS = `   *      Multi-character wildcard — replaces any number of characters. e.g. appli*  /  def*n
   ?      Single-character wildcard — replaces one character, for spelling variants. e.g. defen?e  /  organi?ation
   " "    Exact phrase — retrieves documents containing the phrase exactly. e.g. "passing off"
   AND    All of the words. e.g. negligence AND causation
   OR     Any of the words. e.g. forfeiture OR eviction
   NOT    Excludes documents where the keyword appears in a particular phrase/context. e.g. Minority NOT "minority shareholder"
   ~#     Proximity — the terms appear within # words of one another. e.g. "breach contract" ~10
   ( )    Grouping — groups terms to be executed together. e.g. (doctor OR surgeon) AND negligence`

const INDEX_PATTERN = '^[LSWD][0-9]+$'
const relatedIndices = {
  type: 'array',
  description: 'Index labels (e.g. "L1", "S2", "W3") of the items this relates to. May be empty.',
  items: { type: 'string', pattern: INDEX_PATTERN },
}

const citations = {
  type: 'array',
  description:
    'Quotations from the uploaded documents that support this point. Empty if no uploaded document is relevant — never invent one.',
  items: {
    type: 'object',
    properties: {
      document: { type: 'string', pattern: '^D[0-9]+$', description: 'The D-label of the document quoted.' },
      quote: {
        type: 'string',
        description: 'The supporting words copied EXACTLY from that document. Never paraphrase inside a quote.',
      },
      pinpoint: {
        type: 'string',
        description:
          'Where in the document the quote appears — the numbered paragraph if the document has them (e.g. "[42]"), otherwise a page or section. Empty if genuinely not determinable.',
      },
    },
    required: ['document', 'quote', 'pinpoint'],
  },
}
const relatedLaw = {
  type: 'array',
  description:
    'Index labels of the items this relates to. MUST include at least one L-label — the law this point is assessed against. May also include S/W labels.',
  minItems: 1,
  items: { type: 'string', pattern: INDEX_PATTERN },
}

const CASE_SUMMARY_TOOL = {
  name: 'report_case_summary',
  description: 'Report a structured, indexed summary of the claimant\'s case for their own preparation.',
  parameters: {
    type: 'object',
    properties: {
      overall_note: {
        type: 'string',
        description:
          'Two or three neutral sentences on what the case is about and how well-documented it currently is. Never a legal conclusion or a prediction.',
      },
      law: {
        type: 'array',
        description:
          'Every rule that bears on this claim, drawn only from the listed sources. Be thorough, not minimal: most claims engage several statutes and several provisions within each. Order most directly relevant first — the resulting L1, L2, … labels follow that order.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short heading, e.g. "SCT monetary limit".' },
            summary: {
              type: 'string',
              description: 'Plain-English explanation of what the rule actually says. 1–3 sentences, no legalese.',
            },
            relevance: {
              type: 'string',
              description:
                "One or two sentences on why this rule bears on THIS claimant's facts specifically, referring to what they said.",
            },
            source: { type: 'string', enum: SOURCE_IDS },
            provisions: {
              type: 'array',
              description:
                'The specific sections or rules engaged, e.g. ["s 5(1)", "s 5(3)(a)"]. List every one that applies. Include a number only if you are confident it is correct — an empty list is better than a guessed section.',
              items: { type: 'string' },
            },
          },
          required: ['title', 'summary', 'relevance', 'source', 'provisions'],
        },
      },
      strengths: {
        type: 'array',
        description: 'The claimant\'s strongest points, based strictly on the facts they gave. Label them S1, S2, …',
        items: {
          type: 'object',
          properties: {
            point: { type: 'string', description: 'The argument in one sentence.' },
            basis: {
              type: 'string',
              description: 'Which of the claimant\'s stated facts or evidence supports it, quoted or closely paraphrased.',
            },
            related: relatedLaw,
            citations,
          },
          required: ['point', 'basis', 'related', 'citations'],
        },
      },
      weaknesses: {
        type: 'array',
        description:
          'Gaps, contradictions or missing evidence that a Referee or the respondent could raise. Be candid and specific. Label them W1, W2, …',
        items: {
          type: 'object',
          properties: {
            point: { type: 'string', description: 'The weakness in one sentence.' },
            why: { type: 'string', description: 'Why it matters, tied to the facts given.' },
            evidence_needed: {
              type: 'string',
              description: 'What document or fact would address it. Describe evidence, not legal strategy.',
            },
            related: relatedLaw,
            citations,
          },
          required: ['point', 'why', 'evidence_needed', 'related', 'citations'],
        },
      },
      searches: {
        type: 'array',
        description:
          'At least ten eLitigation advanced searches for finding relevant judgments, ordered from the broadest scope to the most specific. The Q1, Q2, … labels follow that order.',
        minItems: 10,
        items: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'The search string, using ONLY the documented operators. Quotes and brackets must be balanced.',
            },
            explanation: {
              type: 'string',
              description:
                'Plain English: what this search asks for and what kind of judgment it is meant to surface. Explain the operators in words — e.g. "finds cases where deposit appears within 10 words of refund".',
            },
            scope: {
              type: 'string',
              enum: ['broad', 'medium', 'narrow'],
              description: 'How tightly this search is drawn.',
            },
            addresses: {
              type: 'array',
              description: 'L/S/W labels this search would help the claimant investigate. May be empty.',
              items: { type: 'string', pattern: INDEX_PATTERN },
            },
          },
          required: ['query', 'explanation', 'scope', 'addresses'],
        },
      },
      links: {
        type: 'array',
        description: 'Which of the listed sources the claimant should read, and why. Only include genuinely relevant ones.',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string', enum: SOURCE_IDS },
            reason: { type: 'string', description: 'One sentence on what to look for there.' },
            related: relatedIndices,
          },
          required: ['source', 'reason', 'related'],
        },
      },
    },
    required: ['overall_note', 'law', 'strengths', 'weaknesses', 'searches', 'links'],
  },
}

const CASE_SUMMARY_PROMPT = `You are the Case Summary layer inside TribUnal, a case-preparation tool for self-represented \
claimants in Singapore's Small Claims Tribunals (SCT). You are NOT a lawyer. You must never give legal advice, \
predict the outcome, tell the claimant what to argue, or state a legal conclusion as settled fact.

You will receive SOURCE FACTS: everything the claimant entered themselves — their eligibility answers, their \
intake answers in their own words, and the case timeline. Treat these as the only facts that exist. Do not \
invent, assume or embellish anything, and do not fill gaps with what "usually" happens.

Your purpose is to give the claimant the most complete picture their own facts will support: every \
statutory provision that could bear on the claim, where their account is strongest, where it is weakest, \
and what they should read next.

Produce an indexed summary with five parts:

1. RELEVANT LAW — the rules that bear on this claim, drawn ONLY from these sources:
${SOURCES.map((s) => `   - ${s.id}: ${s.label} — ${s.about}`).join('\n')}
   Work through the list systematically and find as many relevant provisions as the facts support. Be \
thorough rather than minimal — most claims engage more than one statute and more than one provision \
within each. A consumer claim against a business, for example, will usually engage the SCT's \
jurisdiction and limit provisions, the procedural rules for lodging and hearing it, AND the consumer \
protection regime; a claim that names the wrong forum will engage the statute that sends it elsewhere. \
Do not stop at the single most obvious rule.
   For each entry give: what the rule says, why it matters for THIS claimant's stated facts, and the \
specific sections engaged. Order entries from most directly relevant to least — the L1, L2, … labels \
follow that order, so the ordering is the ranking.
   Cite a section number only where you are confident it is correct; an empty provision list is better \
than a guessed section. Never cite case law, judgments, other statutes, or anything not on the list \
above — a fabricated authority is worse than no authority.

2. STRONGEST ARGUMENTS — the points where the claimant's own account and evidence are clearest. Each must \
trace back to a specific stated fact: quote or closely paraphrase the claimant's own words in the basis \
field, so they can see exactly what the point rests on. Each MUST cite at least one L-label: the rule it \
is strong under. If no listed rule fits, add that rule to RELEVANT LAW first. Label S1, S2, …

3. WEAKNESSES — be critical and specific. Look for: facts stated without evidence, dates or amounts that are \
vague or inconsistent, anything the claimant said they were unsure about, steps not yet taken (e.g. no \
demand made, no attempt to negotiate), legal conclusions asserted as fact, and points the respondent \
would obviously dispute. For each, say what evidence would address it, and cite at least one L-label: \
the rule the gap matters under. Label W1, W2, … A thin or one-sided account should produce more \
weaknesses, not fewer. Do not soften a real problem to be encouraging.

4. CASE SEARCHES — at least TEN searches the claimant can run on the Singapore Judiciary judgments site to \
find relevant case law. Use ONLY these eLitigation advanced-search operators:

${SEARCH_OPERATORS}

   Order them from the broadest scope to the most specific: start with searches that would return the \
general area of law, and narrow towards the precise factual configuration of this claim. Vary the \
technique — use exact phrases, proximity, wildcards for word variants (refund*, terminat*), OR-groups \
for synonyms the courts might use, and NOT to exclude a neighbouring area that would otherwise flood \
the results.
   Every search MUST be accompanied by a plain-English explanation of what it asks for — say what the \
operators do in words, so the claimant understands the search rather than just pasting it. Keep quotes \
and brackets balanced. Choose distinctive keywords: words that appear in almost every judgment will \
bury the useful results.
   Do NOT name any case, judge or citation anywhere. Your job here is to help the claimant FIND \
judgments, never to assert what they say.

5. LINKS — which of the listed sources the claimant should actually read, with one sentence on what to \
look for there, and which L/S/W items each supports. Only include sources relevant to this claim.

UPLOADED DOCUMENTS
The claimant may also supply documents — judgments, statutes, contracts, correspondence — labelled D1, D2, …
When they do, ground your strengths and weaknesses in them. For each point, quote the words that support it \
in the citations field, and say where the quote appears: the numbered paragraph if the document has \
numbering (judgments do), otherwise the page or section.

Quoting rules, which matter more than anything else here:
- Copy quotes CHARACTER FOR CHARACTER from the document text you were given. Never paraphrase inside \
quotation marks, never tidy up wording, never merge two passages into one quote.
- Only ever quote from the documents actually provided below. If none is relevant to a point, leave its \
citations empty. An empty citation list is always better than an invented one.
- A document marked "[TRUNCATED]" was cut short; do not cite anything you were not shown.
- Every quote is checked against the source text after you reply, and anything that does not match is \
flagged to the claimant as unverified. Accuracy is not optional.

Write in plain English for a layperson. Always call the report_case_summary tool — never reply in plain text.`

const asArray = (v) => (Array.isArray(v) ? v : [])
const cleanIndices = (v) => asArray(v).filter((x) => typeof x === 'string' && /^[LSWD][0-9]+$/.test(x))

// Collapses whitespace and normalises the quote marks and dashes that PDF
// extraction and the model disagree about, so verification compares words
// rather than typography.
const normalise = (s) =>
  String(s)
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// A search the site will reject helps nobody, so the syntax is checked here
// rather than trusted. Returns a short problem description, or '' if fine.
function searchSyntaxProblem(query) {
  if (!query.trim()) return 'empty search'
  if ((query.match(/"/g) ?? []).length % 2 !== 0) return 'unbalanced quotation marks'
  let depth = 0
  for (const ch of query) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (depth < 0) return 'unbalanced brackets'
  }
  if (depth !== 0) return 'unbalanced brackets'
  if (/~(?!\d)/.test(query)) return 'proximity operator is missing its number'
  if (/\b(and|or|not)\b/.test(query)) return 'AND, OR and NOT must be uppercase'
  return ''
}

// Every quote is checked against the document it claims to come from. The
// model attesting to its own output would be circular, so this is done here,
// deterministically. Unverified quotes are kept but flagged, never silently
// dropped — the claimant needs to know which ones to check by hand.
function verifyCitations(raw, docsByIndex) {
  return asArray(raw)
    .filter((c) => docsByIndex[c?.document])
    .map((c) => {
      const doc = docsByIndex[c.document]
      const quote = String(c.quote ?? '').trim()
      return {
        document: c.document,
        documentName: doc.name,
        quote,
        pinpoint: String(c.pinpoint ?? '').trim(),
        verified: quote.length > 0 && normalise(doc.text).includes(normalise(quote)),
      }
    })
    .filter((c) => c.quote)
}

// Normalises the model's output before it reaches the browser: assigns
// index labels by position (so they always line up with the order shown),
// resolves source ids to real URLs, and drops anything citing a source
// outside the allow-list.
function shapeCaseSummary(raw, docs = []) {
  const docsByIndex = Object.fromEntries(docs.map((d) => [d.index, d]))
  const law = asArray(raw.law)
    .filter((l) => sourceById[l.source])
    .map((l, i) => ({
      index: `L${i + 1}`,
      title: String(l.title ?? ''),
      summary: String(l.summary ?? ''),
      relevance: String(l.relevance ?? ''),
      provisions: asArray(l.provisions).map((p) => String(p).trim()).filter(Boolean),
      source: sourceById[l.source],
    }))
  const strengths = asArray(raw.strengths).map((s, i) => ({
    index: `S${i + 1}`,
    point: String(s.point ?? ''),
    basis: String(s.basis ?? ''),
    related: cleanIndices(s.related),
    citations: verifyCitations(s.citations, docsByIndex),
  }))
  const weaknesses = asArray(raw.weaknesses).map((w, i) => ({
    index: `W${i + 1}`,
    point: String(w.point ?? ''),
    why: String(w.why ?? ''),
    evidenceNeeded: String(w.evidence_needed ?? ''),
    related: cleanIndices(w.related),
    citations: verifyCitations(w.citations, docsByIndex),
  }))
  const scopeRank = { broad: 0, medium: 1, narrow: 2 }
  const searches = asArray(raw.searches)
    .map((s) => ({ query: String(s.query ?? '').trim(), explanation: String(s.explanation ?? ''), scope: s.scope, addresses: cleanIndices(s.addresses) }))
    .filter((s) => s.query)
    .sort((a, b) => (scopeRank[a.scope] ?? 1) - (scopeRank[b.scope] ?? 1))
    .map((s, i) => ({ ...s, index: `Q${i + 1}`, problem: searchSyntaxProblem(s.query) }))

  const seen = new Set()
  const links = asArray(raw.links)
    .filter((l) => sourceById[l.source] && !seen.has(l.source) && seen.add(l.source))
    .map((l) => ({
      ...sourceById[l.source],
      reason: String(l.reason ?? ''),
      related: cleanIndices(l.related),
    }))
  return {
    overallNote: String(raw.overall_note ?? ''),
    law,
    strengths,
    weaknesses,
    searches,
    links,
    documents: docs.map((d) => ({ index: d.index, name: d.name, truncated: d.truncated })),
  }
}

app.post('/api/case-summary', async (req, res) => {
  if (!openai) return res.status(503).json({ error: NO_KEY_ERROR })

  const { sourceFacts, documents } = req.body ?? {}
  if (!sourceFacts || typeof sourceFacts !== 'object' || !sourceFacts.intakeAnswers) {
    return res.status(400).json({ error: 'Complete the intake questionnaire before generating a case summary.' })
  }

  const docs = prepareDocuments(documents)
  try {
    const raw = await runStructured({
      system: CASE_SUMMARY_PROMPT,
      user: {
        sourceFacts,
        uploadedDocuments: docs.map((d) => ({
          index: d.index,
          name: d.name,
          text: d.truncated ? `${d.text}\n\n[TRUNCATED — the rest of this document was not provided]` : d.text,
        })),
      },
      tool: CASE_SUMMARY_TOOL,
      maxTokens: 9000,
    })
    res.json(shapeCaseSummary(raw, docs))
  } catch (err) {
    console.error('Case summary request failed:', err)
    res.status(502).json({ error: err.message || 'Could not reach the model.' })
  }
})

// ---------------------------------------------------------------------------
// Case title
// ---------------------------------------------------------------------------

const CASE_TITLE_TOOL = {
  name: 'report_case_title',
  description: 'Report a short neutral title for the case file and the respondent\'s name, if stated.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description:
          'Three to eight words naming the subject of the dispute, like a court list heading: e.g. "Unrefunded motor vehicle deposit", "Incomplete renovation works". No party names, no legal conclusions such as "breach", "fraud" or "negligence".',
      },
      respondent: {
        type: 'string',
        description:
          'The other party\'s name exactly as the claimant wrote it (person or business). Empty string if the claimant did not name them.',
      },
    },
    required: ['title', 'respondent'],
  },
}

const CASE_TITLE_PROMPT = `You label case files inside TribUnal, a case-preparation tool for self-represented claimants in \
Singapore's Small Claims Tribunals. You will receive the claimant's own intake answers. Produce a short, neutral \
title that describes what the dispute is about — never who is at fault or whether the claim is good. Copy the \
respondent's name only if the claimant actually stated it; never guess. Always call the report_case_title tool.`

app.post('/api/case-title', async (req, res) => {
  if (!openai) return res.status(503).json({ error: NO_KEY_ERROR })

  const { sourceFacts } = req.body ?? {}
  if (!sourceFacts?.intakeAnswers) {
    return res.status(400).json({ error: 'Intake answers are required to name the case.' })
  }

  try {
    const raw = await runStructured({
      system: CASE_TITLE_PROMPT,
      user: { sourceFacts },
      tool: CASE_TITLE_TOOL,
      maxTokens: 200,
    })
    res.json({
      title: String(raw.title ?? '').trim().slice(0, 80),
      respondent: String(raw.respondent ?? '').trim().slice(0, 120),
    })
  } catch (err) {
    console.error('Case title request failed:', err)
    res.status(502).json({ error: err.message || 'Could not reach the model.' })
  }
})

app.listen(PORT, () => {
  console.log(`TribUnal API server listening on http://localhost:${PORT}`)
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY is not set — AI endpoints will return 503 until it is.')
  }
})
