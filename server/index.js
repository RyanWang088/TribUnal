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
// Anchoring guard: every call is built here from scratch — a system prompt
// and one user message carrying the structured fact record. No prior turn,
// no earlier answer and no previous artifact is ever appended. Each
// artifact (summary, reality check, title) is therefore regenerated from
// the facts the claimant recorded, not from a conversation that has been
// drifting away from them. Do not add a messages/history parameter here.
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
// Every supporting argument is a dotpoint, and every dotpoint has to say what
// it rests on: a provision, or a case with the paragraph it was read at, plus
// the quotation itself where the source is a document the claimant uploaded.
// A dotpoint that cannot point at anything is an assertion, and assertions are
// what this tool exists to catch.
const dotpoints = {
  type: 'array',
  description: 'Supporting arguments as dotpoints. Each one carries its own pinpoint reference and quotations.',
  minItems: 1,
  maxItems: 5,
  items: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The supporting point, in one sentence.' },
      authority: {
        type: 'string',
        description:
          'The pinpoint reference this point rests on: a statute provision ("Small Claims Tribunals Act 1984 s 5(3)(a)") or a case with the paragraph ("[2019] 2 SLR 1234 at [42]"). Where the point rests only on what the claimant themselves said, write "Claimant\'s own account" — never leave this empty and never invent a reference to fill it.',
      },
      citations,
    },
    required: ['text', 'authority', 'citations'],
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
            summary_points: {
              type: 'array',
              description:
                'What the rule actually says, as 2-4 short bullet points in plain English. One idea per bullet, no legalese, no sentence fragments joined by semicolons.',
              minItems: 1,
              maxItems: 4,
              items: { type: 'string' },
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
            case_citation: {
              type: 'string',
              description:
                'Neutral citation of the reported Singapore decision most relevant to this provision, in the form "[Year] Volume ReportSeries Page" (e.g. "[2019] 2 SLR 1234") or "[Year] Court Number" (e.g. "[2019] SGHC 123"). Give the citation of a decision you actually know, choosing a leading one you can cite exactly over a more apposite one you would have to reconstruct. Return an empty string only if you know of no decision on this provision at all.',
            },
          },
          required: ['title', 'summary_points', 'relevance', 'source', 'provisions', 'case_citation'],
        },
      },
      strengths: {
        type: 'array',
        description: 'The claimant\'s strongest points, based strictly on the facts they gave. Label them S1, S2, …',
        items: {
          type: 'object',
          properties: {
            point: { type: 'string', description: 'The argument in one sentence.' },
            basis_points: dotpoints,
            related: relatedLaw,
          },
          required: ['point', 'basis_points', 'related'],
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
            why_points: dotpoints,
            evidence_needed: {
              type: 'string',
              description: 'What document or fact would address it. Describe evidence, not legal strategy.',
            },
            related: relatedLaw,
          },
          required: ['point', 'why_points', 'evidence_needed', 'related'],
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
            control_f: {
              type: 'array',
              description:
                'Words and phrases to Control-F for inside a judgment this search returns, so the claimant can find the relevant passage without reading the whole thing. 2-5 entries, each a term that would actually appear in a judgment.',
              minItems: 2,
              maxItems: 5,
              items: { type: 'string' },
            },
            addresses: {
              type: 'array',
              description: 'L/S/W labels this search would help the claimant investigate. May be empty.',
              items: { type: 'string', pattern: INDEX_PATTERN },
            },
          },
          required: ['query', 'explanation', 'scope', 'control_f', 'addresses'],
        },
      },
      organisation: {
        type: 'object',
        description:
          'How the claimant should order their argument. Strongest point first and weakest last, unless another ordering follows the case better.',
        properties: {
          approach: {
            type: 'string',
            description:
              'Short name for the ordering used, e.g. "Strongest to weakest", "By issue", "Chronological".',
          },
          rationale: {
            type: 'string',
            description:
              'One or two sentences on why this ordering suits this case. If it is not strongest-to-weakest, say what makes this order easier to follow.',
          },
          sections: {
            type: 'array',
            description: 'The parts of the argument, in the order the claimant should present them.',
            minItems: 2,
            items: {
              type: 'object',
              properties: {
                heading: { type: 'string', description: 'Short heading for this part of the argument.' },
                points: dotpoints,
                related: relatedIndices,
              },
              required: ['heading', 'points', 'related'],
            },
          },
        },
        required: ['approach', 'rationale', 'sections'],
      },
      digest_prompts: {
        type: 'array',
        description:
          'Short prompts the claimant can paste into an AI assistant along with a judgment they downloaded, to make sense of it. Each must ask for something checkable against the text of the judgment, never a prediction about their own case.',
        minItems: 3,
        maxItems: 6,
        items: { type: 'string' },
      },
      further_sources: {
        type: 'array',
        description:
          'Further cases or statutes the claimant should source and feed back in, and why each would help.',
        items: {
          type: 'object',
          properties: {
            what: { type: 'string', description: 'What to go and find, described so they could search for it.' },
            why: { type: 'string', description: 'What gap in the current picture it would fill.' },
            related: relatedIndices,
          },
          required: ['what', 'why', 'related'],
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
    required: ['overall_note', 'law', 'strengths', 'weaknesses', 'organisation', 'searches', 'digest_prompts', 'further_sources', 'links'],
  },
}

const CASE_SUMMARY_PROMPT = `You are the Case Summary layer inside TribUnal, a case-preparation tool for self-represented \
claimants in Singapore's Small Claims Tribunals (SCT). You are NOT a lawyer. You must never give legal advice, \
predict the outcome, tell the claimant what to argue, or state a legal conclusion as settled fact.

PURPOSE
- Find as many relevant statutes and provisions as possible.
- Recommend Boolean or advanced searches to find relevant cases.
- Recommend words and phrases to Control-F for within those cases.
- Recommend ways to digest the cases using AI.

RULES
- ALWAYS build recommended searches from the advanced-search operators set out below, and nothing else.
- ALWAYS accompany every recommended search with a natural-language explanation of what the search means.

You will receive SOURCE FACTS: everything the claimant entered themselves — their eligibility answers, their \
intake answers in their own words, and the case timeline. Treat these as the only facts that exist. Do not \
invent, assume or embellish anything, and do not fill gaps with what "usually" happens.

METHOD

1. Read all the client information and case information you are given before writing anything.

2. STATUTE SEARCHES — research and recommend as many relevant Singapore statutes as possible, drawn ONLY \
from these sources:
${SOURCES.map((s) => `   - ${s.id}: ${s.label} — ${s.about}`).join('\n')}
   Each statute is a heading; under each heading recommend as many relevant provisions as possible. Work \
through the list systematically and be thorough rather than minimal — most claims engage more than one \
statute and more than one provision within each. A consumer claim against a business, for example, will \
usually engage the SCT's jurisdiction and limit provisions, the procedural rules for lodging and hearing \
it, AND the consumer protection regime; a claim that names the wrong forum will engage the statute that \
sends it elsewhere. Do not stop at the single most obvious rule.
   For each entry give: what the rule says AS 2-4 SHORT BULLET POINTS (one idea per bullet, plain \
English, no legalese), why it matters for THIS claimant's stated facts, and the specific sections \
engaged. ALWAYS order the headings from most directly relevant to least — the L1, L2, … labels follow \
that order, so the ordering is the ranking. The claimant is shown the required non-exhaustiveness \
disclaimer beneath this section automatically; you do not need to write it.
   Cite a section number only where you are confident it is correct; an empty provision list is better \
than a guessed section. Never cite other statutes or anything not on the list above — a fabricated \
authority is worse than no authority.
   The case_citation field is the ONE place you may name a decision. Give the neutral citation of \
the reported Singapore decision most relevant to the provision, so the claimant has a real starting \
point to look up rather than a blank. Prefer a leading, well-known decision you can cite exactly \
over a more precisely apposite one whose citation you would have to reconstruct: the citation has \
to be right, the choice of case only has to be useful. Return an empty string only where you know \
of no decision on the provision at all. Every citation is checked for form, shown to the claimant \
as unverified until they confirm it in the database themselves, and stripped from any export until \
they do.

3. STRONGEST ARGUMENTS — the points where the claimant's own account and evidence are clearest. Each must \
trace back to specific stated facts: give 2-4 SHORT BULLET POINTS in the basis_points field, quoting or \
closely paraphrasing the claimant's own words, one fact per bullet, so they can see exactly what the \
point rests on. Each MUST cite at least one L-label: the rule it is strong under. If no listed rule fits, \
add that rule to STATUTE SEARCHES first. Label S1, S2, …

4. WEAKNESSES — be critical and specific. Look for: facts stated without evidence, dates or amounts that are \
vague or inconsistent, anything the claimant said they were unsure about, steps not yet taken (e.g. no \
demand made, no attempt to negotiate), legal conclusions asserted as fact, and points the respondent \
would obviously dispute. For each, say what evidence would address it, and cite at least one L-label: \
the rule the gap matters under. Label W1, W2, … A thin or one-sided account should produce more \
weaknesses, not fewer. Do not soften a real problem to be encouraging. Give the reasons as 2-4 SHORT \
BULLET POINTS in the why_points field, one reason per bullet.

5. ORGANISATION — how the claimant should order their argument. Default to strongest point first and \
weakest last. Depart from that ONLY where another organisation is genuinely easier to follow — by issue, \
by chronological step, by element of the claim — and if you do, say in the rationale why that ordering \
follows the case better. Give each part of the structure a heading and dotpoints saying what goes \
there and why, referring to the S and W labels the part draws on.

6. CASE SEARCHES — at least TEN searches the claimant can run on the Singapore Judiciary judgments site to \
find relevant case law. Use ONLY these advanced-search operators:

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
   For each search, also give the words and phrases the claimant should Control-F for once a judgment is \
open, so they can find the relevant passage without reading the whole thing.
   Do NOT name any case, judge or citation in a SEARCH. A search is a query, not an authority: your job \
here is to help the claimant FIND judgments, never to assert what they say.

7. DIGESTING WITH AI — short, concrete prompts the claimant can paste into an AI assistant, together with a \
judgment they have downloaded, to make sense of it. Each prompt should ask for something checkable \
against the text of the judgment — its facts, its issue, what the court decided and at which paragraph — \
never for a prediction about the claimant's own case.

EVERY DOTPOINT, EVERYWHERE
Every supporting argument in STRONGEST ARGUMENTS, WEAKNESSES and ORGANISATION is a dotpoint, and every \
dotpoint carries its own authority field: a pinpoint reference to the provision, or to the case and the \
paragraph it was read at ("Small Claims Tribunals Act 1984 s 5(3)(a)", "[2019] 2 SLR 1234 at [42]"). \
Where a dotpoint rests only on what the claimant told you, the authority is "Claimant's own account" — \
say that plainly rather than dressing an assertion up as an authority. Where the source is a document \
the claimant uploaded, the dotpoint must ALSO carry the quotation itself in its citations field, with \
the document it comes from and the paragraph it appears at. A dotpoint that can point at nothing does \
not belong in the list at all.


8. FURTHER SOURCES — what further cases or statutes the claimant should source and feed back in, and why \
each would help. Be specific about what is currently missing from the picture.

UPLOADED DOCUMENTS
The claimant may also supply documents — judgments, statutes, contracts, correspondence — labelled D1, D2, …
When they do, ground your strengths, weaknesses and organisation in them. For each point, quote the words \
that support it in the citations field, and say where the quote appears: the numbered paragraph if the \
document has numbering (judgments do), otherwise the page or section. Every dotpoint that rests on an \
uploaded document MUST carry its quotation and pinpoint.

Quoting rules, which matter more than anything else here:
- Copy quotes CHARACTER FOR CHARACTER from the document text you were given. Never paraphrase inside \
quotation marks, never tidy up wording, never merge two passages into one quote.
- Only ever quote from the documents actually provided below. If none is relevant to a point, leave its \
citations empty. An empty citation list is always better than an invented one.
- A document marked "[TRUNCATED]" was cut short; do not cite anything you were not shown.
- Every quote is checked against the source text after you reply. A quote that does not appear in the \
document it names is DELETED, and any point left with no surviving citation is deleted with it. \
Inventing a citation therefore destroys the point it was meant to support. Accuracy is not optional.

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

// Provisions are the citations attached to a rule. There is no statute-text
// database here to look a section number up in, so what can be checked is the
// shape: "s 5(3)(a)", "r 12", "reg 4", "First Schedule". Anything that is not
// recognisably a provision reference is not a citation at all and is dropped.
// Whether a well-formed section number says what the summary claims is left to
// the claimant to confirm against SSO — see the verification gate on the client.
const PROVISION_PATTERN =
  /^(?:ss?|rr?|regs?|arts?|paras?|paragraphs?|sections?|rules?|regulations?|articles?)\.?\s*\d/i
const SCHEDULE_PATTERN = /schedule/i

function provisionLooksValid(p) {
  return PROVISION_PATTERN.test(p) || SCHEDULE_PATTERN.test(p)
}

// A case citation the model volunteered. There is no judgments database here
// to look it up in, so as with provisions only the form can be checked:
// "[2019] 2 SLR 1234" or "[2019] SGHC 123". Anything else is not a citation
// and is dropped. Whether a well-formed citation names a decision that exists
// is exactly what the claimant is asked to confirm before it can be exported.
const CASE_CITATION_PATTERN = /^\[(?:19|20)\d{2}\]\s+(?:\d+\s+)?[A-Z][A-Za-z()]{1,12}\s+\d+$/

function caseCitationLooksValid(c) {
  return CASE_CITATION_PATTERN.test(c)
}

// Removing false positives: every quote has already been checked against the
// document it names, so here the ones that were not found are deleted rather
// than shown with a warning. A quote the document does not contain is not a
// citation; leaving it on screen only invites the claimant to rely on it.
const keepVerified = (citations) => citations.filter((c) => c.verified)

// Checking omissions: a point that cited a document but has no citation left
// once the false positives are gone is unsupported, so the point goes with
// them. A point that never claimed a citation is left alone — when nothing has
// been uploaded there is no database to check against, and deleting every
// point would say more about the empty document store than about the case.
function pruneUnsupported(items) {
  const removed = []
  const kept = []
  for (const item of items) {
    if (item.claimedCitations > 0 && item.citations.length === 0) removed.push(item)
    else kept.push(item)
  }
  return { kept, removed }
}

// Normalises the model's output before it reaches the browser: deletes
// citations that do not check out and the points left unsupported by their
// removal, assigns index labels by position, resolves source ids to real URLs,
// and drops anything citing a source outside the allow-list.
function shapeCaseSummary(raw, docs = []) {
  const docsByIndex = Object.fromEntries(docs.map((d) => [d.index, d]))
  const integrity = {
    documentsSupplied: docs.length,
    citationsChecked: 0,
    citationsDeleted: 0,
    provisionsDeleted: 0,
    caseCitationsDeleted: 0,
    pointsDeleted: 0,
  }

  const law = asArray(raw.law)
    .filter((l) => sourceById[l.source])
    .map((l, i) => {
      const claimed = asArray(l.provisions).map((p) => String(p).trim()).filter(Boolean)
      const provisions = claimed.filter(provisionLooksValid)
      integrity.provisionsDeleted += claimed.length - provisions.length
      const claimedCase = String(l.case_citation ?? '').trim()
      const caseCitation = caseCitationLooksValid(claimedCase) ? claimedCase : ''
      if (claimedCase && !caseCitation) integrity.caseCitationsDeleted += 1
      return {
        index: `L${i + 1}`,
        title: String(l.title ?? ''),
        summaryPoints: asArray(l.summary_points).map((t) => String(t).trim()).filter(Boolean),
        relevance: String(l.relevance ?? ''),
        provisions,
        caseCitation,
        source: sourceById[l.source],
      }
    })

  // Verify, delete the false positives, then drop the points left unsupported.
  function gradeCitations(rawCitations) {
    const checked = verifyCitations(rawCitations, docsByIndex)
    const citations = keepVerified(checked)
    integrity.citationsChecked += checked.length
    integrity.citationsDeleted += checked.length - citations.length
    return { citations, claimedCitations: checked.length }
  }

  // Each supporting argument is a dotpoint with its own pinpoint reference and
  // its own quotations, so verification and pruning happen per dotpoint rather
  // than per item. Older stored output had plain strings here; those are kept
  // as text with no authority rather than discarded.
  function gradeDotpoints(raw) {
    const graded = asArray(raw)
      .map((d) => {
        if (typeof d === 'string') {
          return { text: d.trim(), authority: '', citations: [], claimedCitations: 0 }
        }
        return {
          text: String(d?.text ?? '').trim(),
          authority: String(d?.authority ?? '').trim(),
          ...gradeCitations(d?.citations),
        }
      })
      .filter((d) => d.text)
    const { kept, removed } = pruneUnsupported(graded)
    integrity.pointsDeleted += removed.length
    for (const d of kept) delete d.claimedCitations
    return kept
  }

  // An item survives only if it still has a dotpoint standing behind it.
  const withPoints = (items) => {
    const kept = items.filter((it) => it.dotpoints.length > 0)
    integrity.pointsDeleted += items.length - kept.length
    return kept
  }
  const rawStrengths = withPoints(
    asArray(raw.strengths).map((s) => ({
      point: String(s.point ?? ''),
      dotpoints: gradeDotpoints(s.basis_points),
      related: cleanIndices(s.related),
    })),
  )
  const rawWeaknesses = withPoints(
    asArray(raw.weaknesses).map((w) => ({
      point: String(w.point ?? ''),
      dotpoints: gradeDotpoints(w.why_points),
      evidenceNeeded: String(w.evidence_needed ?? ''),
      related: cleanIndices(w.related),
    })),
  )

  const prunedS = { kept: rawStrengths }
  const prunedW = { kept: rawWeaknesses }

  // Labels are assigned after pruning so they stay contiguous, which means
  // cross-references written against the pre-prune ordering have to be
  // remapped. A reference to a deleted point is dropped rather than left
  // pointing at nothing.
  const remap = {}
  const label = (items, prefix, originals) =>
    items.map((item, i) => {
      const index = `${prefix}${i + 1}`
      remap[`${prefix}${originals.indexOf(item) + 1}`] = index
      return { ...item, index }
    })
  const strengths = label(prunedS.kept, 'S', rawStrengths)
  const weaknesses = label(prunedW.kept, 'W', rawWeaknesses)

  const fixRefs = (refs) =>
    refs.map((r) => (r[0] === 'S' || r[0] === 'W' ? remap[r] : r)).filter(Boolean)
  for (const item of [...strengths, ...weaknesses]) item.related = fixRefs(item.related)

  const scopeRank = { broad: 0, medium: 1, narrow: 2 }
  const searches = asArray(raw.searches)
    .map((s) => ({
      query: String(s.query ?? '').trim(),
      explanation: String(s.explanation ?? ''),
      scope: s.scope,
      controlF: asArray(s.control_f).map((t) => String(t).trim()).filter(Boolean),
      addresses: fixRefs(cleanIndices(s.addresses)),
    }))
    .filter((s) => s.query)
    .sort((a, b) => (scopeRank[a.scope] ?? 1) - (scopeRank[b.scope] ?? 1))
    .map((s, i) => ({ ...s, index: `Q${i + 1}`, problem: searchSyntaxProblem(s.query) }))

  const seen = new Set()
  const links = asArray(raw.links)
    .filter((l) => sourceById[l.source] && !seen.has(l.source) && seen.add(l.source))
    .map((l) => ({
      ...sourceById[l.source],
      reason: String(l.reason ?? ''),
      related: fixRefs(cleanIndices(l.related)),
    }))
  // The organisation dotpoints go through the same citation pipeline as the
  // strengths and weaknesses: quotes that are not in the document they name
  // are deleted, and a section left with nothing is dropped.
  const orgSections = withPoints(
    asArray(raw.organisation?.sections).map((sec) => ({
      heading: String(sec.heading ?? ''),
      dotpoints: gradeDotpoints(sec.points),
      related: fixRefs(cleanIndices(sec.related)),
    })),
  )
  const organisation = raw.organisation
    ? {
        approach: String(raw.organisation.approach ?? ''),
        rationale: String(raw.organisation.rationale ?? ''),
        sections: orgSections,
      }
    : null

  return {
    overallNote: String(raw.overall_note ?? ''),
    law,
    strengths,
    weaknesses,
    organisation,
    searches,
    digestPrompts: asArray(raw.digest_prompts).map((t) => String(t).trim()).filter(Boolean),
    furtherSources: asArray(raw.further_sources)
      .map((f) => ({ what: String(f.what ?? ''), why: String(f.why ?? ''), related: fixRefs(cleanIndices(f.related)) }))
      .filter((f) => f.what),
    links,
    integrity,
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
