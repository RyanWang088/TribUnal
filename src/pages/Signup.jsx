import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'

export default function Signup() {
  const { signUp, authError, clearAuthError } = useCase()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    clearAuthError()
    if (!name.trim() || !username.trim() || !password) {
      setFormError('Please fill in every field.')
      return
    }
    if (password.length < 6) {
      setFormError('Password should be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.')
      return
    }
    setFormError('')
    if (signUp(username, password, name)) {
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
            <p>Create your case preparation account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Full name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="e.g. Tan Ah Kow"
            />
          </label>
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
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </label>
          {(formError || authError) && <div className="form-error">{formError || authError}</div>}
          <button type="submit" className="btn btn-primary btn-block">
            Create account
          </button>
        </form>

        <p className="login-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>

        <p className="login-disclaimer">
          Your details stay on this device for this prototype. TribUnal does not give legal advice and
          does not decide your case.
        </p>
      </div>
    </div>
  )
}
