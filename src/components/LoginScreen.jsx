import { useState } from 'react'

export default function LoginScreen({ onSignIn, onSignUp }) {
  const [mode, setMode]         = useState('signin') // 'signin' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false) // signup confirmation

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const err = mode === 'signin'
      ? await onSignIn(email, password)
      : await onSignUp(email, password)

    setLoading(false)

    if (err) {
      setError(err.message)
    } else if (mode === 'signup') {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <p className="login-logo">Trigger</p>
          <p className="login-confirm-icon">📬</p>
          <p className="login-confirm-msg">Check your email to confirm your account, then sign in.</p>
          <button className="btn-ghost login-switch" onClick={() => { setDone(false); setMode('signin') }}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <p className="login-logo">Trigger</p>
        <p className="login-tagline">Your ADHD task brain.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
          />

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="btn-primary login-submit"
            disabled={loading || !email || !password}
          >
            {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          className="btn-ghost login-switch"
          onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null) }}
        >
          {mode === 'signin' ? 'No account? Create one' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
