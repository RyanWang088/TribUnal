import { useState } from 'react'

// Shown every time a case dashboard mounts: on first entry, after a
// refresh, and every time the user navigates back into a case. It is not
// dismissed permanently anywhere (no localStorage flag) because the
// requirement is that it reappears each time the page loads.
export default function DisclaimerModal({ onContinue }) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="disclaimer-overlay" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
      <div className="disclaimer-box">
        <div className="disclaimer-head">
          <span className="disclaimer-flag">⚠</span>
          <h2 id="disclaimer-title">NOT legal advice</h2>
        </div>
        <div className="disclaimer-body">
          <p>
            TribUnal is an AI-assisted tool designed to help you navigate the Small Claims
            Tribunals process, organise your case, and critically evaluate AI-generated information.
          </p>
          <p>
            It does not provide legal advice, determine the merits of your claim, or predict the
            outcome of your case.
          </p>
          <p>
            AI-generated information may be inaccurate, incomplete, or outdated. You are responsible
            for independently verifying all facts, dates, amounts, evidence and legal information
            before relying on or submitting them to the Court.
          </p>
          <p>
            <strong>Never use AI to create, alter or invent evidence, facts, case law or legal
            authorities.</strong>
          </p>
        </div>
        <label className="disclaimer-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          I understand that I am responsible for verifying information before using it in my case.
        </label>
        <button type="button" className="btn btn-primary btn-block" disabled={!checked} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  )
}
