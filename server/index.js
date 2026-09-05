// Minimal backend for the Reality Check feature. Its only job is to hold
// the Anthropic API key server-side and forward one request type. Nothing
// else in TribUnal needs a backend yet — this exists purely so the key
// never ships inside the browser bundle.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const PORT = process.env.PORT || 8787
const apiKey = process.env.ANTHROPIC_API_KEY

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const anthropic = apiKey ? new Anthropic({ apiKey }) : null

const REALITY_CHECK_TOOL = {
  name: 'report_reality_check',
  description: 'Report the fact-check and bias review of a claimant\'s draft statement.',
  input_schema: {
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
  if (!anthropic) {
    return res.status(503).json({
      error: 'ANTHROPIC_API_KEY is not set. Add it to server/.env (see server/.env.example) and restart the server.',
    })
  }

  const { sourceFacts, draft } = req.body ?? {}
  if (!draft || !draft.trim()) {
    return res.status(400).json({ error: 'Missing "draft" text to check.' })
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: [REALITY_CHECK_TOOL],
      tool_choice: { type: 'tool', name: 'report_reality_check' },
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ sourceFacts: sourceFacts ?? {}, draft }),
        },
      ],
    })

    const toolUse = message.content.find((block) => block.type === 'tool_use')
    if (!toolUse) {
      return res.status(502).json({ error: 'The model did not return a structured result. Try again.' })
    }
    res.json(toolUse.input)
  } catch (err) {
    console.error('Reality check request failed:', err)
    res.status(502).json({ error: 'Could not reach the model. Check the server logs and your API key.' })
  }
})

app.listen(PORT, () => {
  console.log(`TribUnal Reality Check server listening on http://localhost:${PORT}`)
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY is not set — /api/reality-check will return 503 until it is.')
  }
})
