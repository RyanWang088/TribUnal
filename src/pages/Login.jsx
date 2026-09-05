import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'

export default function Login() {
  const { login, authError, clearAuthError } = useCase()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    clearAuthError()
    if (!username.trim() || !password) {
      setFormError('Please enter both your username and password.')
      return
    }
    setFormError('')
    if (login(username, password)) {
      navigate('/dashboard')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">TU</div>
          <div>
            <h1>TribUnal</h1>
            <p>Small Claims Tribunals case preparation assistant</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="e.g. tan.ah.kow"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>
          {(formError || authError) && <div className="form-error">{formError || authError}</div>}
          <button type="submit" className="btn btn-primary btn-block">
            Log in
          </button>
          <button type="button" className="btn btn-outline btn-block" onClick={() => navigate('/signup')}>
            Sign up
          </button>
        </form>

        <p className="login-disclaimer">
          TribUnal helps you organise and stress-test your claim. It does not give legal advice and
          does not decide your case. You remain responsible for verifying everything before you file.
        </p>
      </div>
    </div>
  )
}
