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

const INDEX_PATTERN = '^[LSW][0-9]+$'
const relatedIndices = {
  type: 'array',
  description: 'Index labels (e.g. "L1", "S2", "W3") of the items this relates to. May be empty.',
  items: { type: 'string', pattern: INDEX_PATTERN },
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
        description: 'Areas of law relevant to this claim, drawn only from the listed sources. Label them L1, L2, … in order.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short heading, e.g. "SCT monetary limit".' },
            summary: {
              type: 'string',
              description: 'Plain-English explanation of the rule and why it matters for this claim. 1–3 sentences.',
            },
            source: { type: 'string', enum: SOURCE_IDS },
            provision: {
              type: 'string',
              description:
                'The section or rule, e.g. "s 5(1)". Leave empty if not certain — never guess a section number.',
            },
          },
          required: ['title', 'summary', 'source', 'provision'],
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
          },
          required: ['point', 'basis', 'related'],
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
          },
          required: ['point', 'why', 'evidence_needed', 'related'],
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
    required: ['overall_note', 'law', 'strengths', 'weaknesses', 'links'],
  },
}

const CASE_SUMMARY_PROMPT = `You are the Case Summary layer inside TribUnal, a case-preparation tool for self-represented \
claimants in Singapore's Small Claims Tribunals (SCT). You are NOT a lawyer. You must never give legal advice, \
predict the outcome, tell the claimant what to argue, or state a legal conclusion as settled fact.

You will receive SOURCE FACTS: everything the claimant entered themselves — their eligibility answers, their \
intake answers in their own words, and the case timeline. Treat these as the only facts that exist. Do not \
invent, assume or embellish anything, and do not fill gaps with what "usually" happens.

Produce an indexed summary with four parts:

1. RELEVANT LAW — the rules that bear on this claim, drawn ONLY from these sources:
${SOURCES.map((s) => `   - ${s.id}: ${s.label} — ${s.about}`).join('\n')}
   Cite the source id. Give a provision number only if you are confident it is right; otherwise leave it \
empty. Never cite case law, other statutes, or anything not on this list. Label items L1, L2, …

2. STRONGEST ARGUMENTS — the points where the claimant's own account and evidence are clearest. Each must \
trace back to a specific stated fact, and each MUST cite at least one L-label: the rule it is strong \
against. If no listed rule applies, add the rule to RELEVANT LAW first. Label S1, S2, …

3. WEAKNESSES — be critical and specific. Look for: facts stated without evidence, dates or amounts that are \
vague or inconsistent, anything the claimant said they were unsure about, steps not yet taken (e.g. no \
demand made, no attempt to negotiate), and points the respondent would obviously dispute. For each, say \
what evidence would address it, and cite at least one L-label: the rule the gap matters under. Label \
W1, W2, … A thin or one-sided account should produce more weaknesses, not fewer.

4. LINKS — which of the listed sources the claimant should actually read, with one sentence on what to \
look for, and which L/S/W items each supports. Only include sources that are relevant to this claim.

Write in plain English for a layperson. Always call the report_case_summary tool — never reply in plain text.`

const asArray = (v) => (Array.isArray(v) ? v : [])
const cleanIndices = (v) => asArray(v).filter((x) => typeof x === 'string' && /^[LSW][0-9]+$/.test(x))

// Normalises the model's output before it reaches the browser: assigns
// index labels by position (so they always line up with the order shown),
// resolves source ids to real URLs, and drops anything citing a source
// outside the allow-list.
function shapeCaseSummary(raw) {
  const law = asArray(raw.law)
    .filter((l) => sourceById[l.source])
    .map((l, i) => ({
      index: `L${i + 1}`,
      title: String(l.title ?? ''),
      summary: String(l.summary ?? ''),
      provision: String(l.provision ?? ''),
      source: sourceById[l.source],
    }))
  const strengths = asArray(raw.strengths).map((s, i) => ({
    index: `S${i + 1}`,
    point: String(s.point ?? ''),
    basis: String(s.basis ?? ''),
    related: cleanIndices(s.related),
  }))
  const weaknesses = asArray(raw.weaknesses).map((w, i) => ({
    index: `W${i + 1}`,
    point: String(w.point ?? ''),
    why: String(w.why ?? ''),
    evidenceNeeded: String(w.evidence_needed ?? ''),
    related: cleanIndices(w.related),
  }))
  const seen = new Set()
  const links = asArray(raw.links)
    .filter((l) => sourceById[l.source] && !seen.has(l.source) && seen.add(l.source))
    .map((l) => ({
      ...sourceById[l.source],
      reason: String(l.reason ?? ''),
      related: cleanIndices(l.related),
    }))
  return { overallNote: String(raw.overall_note ?? ''), law, strengths, weaknesses, links }
}

app.post('/api/case-summary', async (req, res) => {
  if (!openai) return res.status(503).json({ error: NO_KEY_ERROR })

  const { sourceFacts } = req.body ?? {}
  if (!sourceFacts || typeof sourceFacts !== 'object' || !sourceFacts.intakeAnswers) {
    return res.status(400).json({ error: 'Complete the intake questionnaire before generating a case summary.' })
  }

  try {
    const raw = await runStructured({
      system: CASE_SUMMARY_PROMPT,
      user: { sourceFacts },
      tool: CASE_SUMMARY_TOOL,
      maxTokens: 3500,
    })
    res.json(shapeCaseSummary(raw))
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
