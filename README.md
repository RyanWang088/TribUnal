# TribUnal

A case-preparation tool for self-represented claimants in Singapore's Small Claims Tribunals (SCT).

TribUnal helps claimants organize their case — intake, timeline of events, hearing calendar — and includes a **Reality Check** feature that uses Claude to fact-check a claimant's draft statement against the facts they've confirmed, and flag one-sided or biased language. It is explicitly not a source of legal advice: it never predicts outcomes or states legal conclusions as fact.

## Features

- **Intake** — capture the facts of a case directly from the claimant.
- **Case Dashboard** — manage one or more cases with a timeline of events and a hearing calendar.
- **Reality Check** — sends a claimant's draft statement and confirmed source facts to Claude, which flags unsupported claims and biased framing via a structured tool call.
- **Auth** — basic login/signup flow gating access to case data.

## Tech stack

- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) on the frontend, [React Router](https://reactrouter.com/) for navigation
- A minimal [Express](https://expressjs.com/) backend whose only job is to hold the Anthropic API key server-side and proxy the Reality Check request
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) (Claude) for the Reality Check analysis
- [Oxlint](https://oxc.rs) for linting

## Getting started

### Prerequisites

- Node.js
- An [Anthropic API key](https://console.anthropic.com/) (only needed for the Reality Check feature)

### Install

```bash
npm install
```

### Configure the Reality Check server

```bash
cp server/.env.example server/.env
# then edit server/.env and set ANTHROPIC_API_KEY
```

### Run

```bash
npm run dev:full   # runs the Vite dev server and the Reality Check API together
```

Or run them separately:

```bash
npm run dev      # frontend only, http://localhost:5173
npm run server   # Reality Check API only, http://localhost:8787
```

### Other scripts

```bash
npm run build     # production build
npm run preview   # preview the production build
npm run lint      # oxlint
```

## Project structure

```
src/
  pages/        # Login, Signup, Intake, MasterDashboard, CaseDashboard, RealityCheck
  components/   # Timeline, CaseCalendar, DisclaimerModal
  context/      # CaseContext (case/user state)
  data/         # case, event, and question fixtures
server/
  index.js      # Express API — proxies /api/reality-check to Claude
```

## Disclaimer

TribUnal is a self-help drafting aid, not a substitute for legal advice. The Reality Check feature checks internal consistency of a draft against facts the claimant themselves provided — it does not verify facts against outside reality, and it never predicts how a tribunal will rule.
