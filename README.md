# TribUnal

A case-preparation tool for self-represented claimants in Singapore's Small Claims Tribunals (SCT).

TribUnal walks a claimant through the SCT process from eligibility to hearing, keeps their facts and documents in one place, and uses an LLM to draft a research plan and fact-check their statement. It is explicitly not a source of legal advice: it never predicts outcomes or states legal conclusions as fact, and nothing the model cites leaves the app until the claimant has checked it against the source themselves.

## Features

- **Eligibility check** — a screen of SCT jurisdiction questions (amount, claim type, time limits, parties), each answer marked eligible, conditional, or not eligible.
- **Intake** — captures the facts of the case from the claimant, plus uploaded documents (PDF and plain-text) whose text is extracted in the browser.
- **Case dashboard** — one or more cases, each with a timeline of events, a hearing calendar, and the eight-stage SCT process (pre-filing to hearing) with a checklist and countdown per stage.
- **Evidence map** — a read-only record of everything entered at intake, so the claimant can see exactly what the AI features work from.
- **Case summary** — an LLM-generated research plan built from the recorded facts and documents:
  1. Statute/Case searches — relevant Singapore statutes from a fixed allow-list, with the sections engaged
  2. Strongest arguments and weaknesses — each as dotpoints that name the provision or case they rest on and quote the uploaded document they come from
  3. Organisation — how to order the argument
  4. Case searches — eLitigation advanced-search queries using only the court's documented operators
  5. Prompts for digesting sources with an AI assistant, and further sources to go and find
- **Citation verification** — every quotation is checked server-side against the document it names and deleted if not found; provisions and case citations are checked for form. What survives is shown as "Not verified" with step-by-step instructions (search the statute and locate the section, or paste the citation into the judgments database and find the paragraph). The claimant ticks two questions per citation, and anything unticked is stripped from exports.
- **Reality check** — sends the claimant's draft statement and confirmed facts to the LLM, which flags claims the facts do not support and one-sided or leading language.
- **Auth** — basic login/signup flow gating access to case data.

## How the AI is kept honest

- The model can only cite statutes from a hard-coded list; anything else is dropped before the response is sent.
- Every call is built from scratch from the recorded facts. No conversation history is ever passed, so each artifact is regenerated from the facts rather than from a drifting chat.
- The model must answer through a single structured tool call; prose replies are rejected.
- Quotes are verified by the server, not by the model, and citations are verified by the claimant, not by either.

## Tech stack

- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) on the frontend, [React Router](https://reactrouter.com/) for navigation
- [pdf.js](https://mozilla.github.io/pdf.js/) for in-browser text extraction, with document text stored in IndexedDB
- A minimal [Express](https://expressjs.com/) backend whose only job is to hold the OpenRouter API key server-side and forward the structured model calls
- [OpenAI SDK](https://github.com/openai/openai-node) pointed at [OpenRouter](https://openrouter.ai/) (OpenAI-compatible API); the default model is `anthropic/claude-sonnet-5`
- [Oxlint](https://oxc.rs) for linting

## Getting started

### Prerequisites

- Node.js
- An [OpenRouter API key](https://openrouter.ai/keys) (only needed for the case summary and reality check features)

### Install

```bash
npm install
```

### Configure the API server

```bash
cp server/.env.example server/.env
# then edit server/.env and set OPENROUTER_API_KEY (and optionally OPENROUTER_MODEL and PORT)
```

### Run

```bash
npm run dev:full
```

This runs the Vite dev server (http://localhost:5173) and the API (http://localhost:8787) together. To run them separately, use `npm run dev` and `npm run server`. Restart the API server after pulling changes to `server/index.js`.

### Other scripts

```bash
npm run build     # production build
npm run preview   # preview the production build
npm run lint      # oxlint
```

## Project structure

```
src/
  pages/        # Login, Signup, Intake, MasterDashboard, CaseDashboard,
                # CaseSummary, EvidenceMap, RealityCheck
  components/   # Timeline, CaseCalendar, StageModal, EligibilityCheck,
                # DisclaimerModal, case/event forms
  context/      # CaseContext (case/user state, persisted to localStorage)
  data/         # stages, eligibility rules, intake questions, citation
                # verification, document store (IndexedDB), PDF text extraction
server/
  index.js      # Express API — /api/case-summary, /api/reality-check,
                # /api/case-title, all proxied to OpenRouter
```

## Disclaimer

TribUnal is a self-help drafting aid, not a substitute for legal advice. The case summary is a research plan, not an opinion: it tells the claimant where to look, and every reference it gives must be verified against the source before it is relied on. The reality check compares a draft against facts the claimant themselves provided; it does not verify facts against outside reality, and it never predicts how a tribunal will rule.
