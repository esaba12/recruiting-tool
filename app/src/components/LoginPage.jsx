import { useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { signInWithGoogle } from '../lib/googleAuth.js'
import { signInWithApiKey } from '../lib/apiKeyAuth.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'

export default function LoginPage({ initialMode = 'signin' }) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState(initialMode) // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  const [apiKeyMode, setApiKeyMode] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiKeyBusy, setApiKeyBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null); setInfo(null); setBusy(true)
    try {
      if (mode === 'signup') {
        await signUp({ email, password, fullName })
        switchMode('signin')
        setInfo('Check your email to confirm your account, then sign in.')
      } else {
        await signIn({ email, password })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    try { await signInWithGoogle() }
    catch (e) { setError(e.message) }
  }

  async function useApiKey(e) {
    e.preventDefault()
    setError(null); setInfo(null); setApiKeyBusy(true)
    try {
      await signInWithApiKey(apiKey)
    } catch (e) {
      setError(e.message)
    } finally {
      setApiKeyBusy(false)
    }
  }

  function switchMode(next) {
    setMode(next); setError(null); setInfo(null)
    // Keep the URL in step so a reload (or a shared link) lands on the same form.
    window.history.replaceState(null, '', next === 'signup' ? '/signup' : '/login')
  }

  const signup = mode === 'signup'
  return (
    <div className="min-h-screen bg-canvas flex flex-col px-4">
      <header className="h-14 flex items-center max-w-6xl w-full mx-auto sm:px-2">
        <a href="/" className="font-heading font-semibold tracking-tight text-ink-900">Recruiting OS</a>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center py-10">
        <div className="w-full max-w-[400px]">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink-900 text-center">
            {signup ? 'Create your account' : 'Sign in to Recruiting OS'}
          </h1>
          <p className="text-sm text-ink-500 mt-2 text-center">
            {signup ? 'Already have an account? ' : 'Don’t have an account? '}
            <button type="button" onClick={() => switchMode(signup ? 'signin' : 'signup')}
              className="font-medium text-link hover:underline underline-offset-2">
              {signup ? 'Sign in' : 'Sign up'}
            </button>
          </p>

          <div className="mt-8 bg-surface border border-ink-200 rounded-lg p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <Button type="button" variant="secondary" onClick={google}
              className="w-full flex items-center justify-center gap-2.5 border-ink-200 font-medium">
              <GoogleIcon /> Continue with Google
            </Button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-ink-200" />
              <span className="text-xs text-ink-500">or</span>
              <div className="flex-1 h-px bg-ink-200" />
            </div>

            {error && <div role="alert" className="mb-4 px-3 py-2.5 bg-danger-50 border border-danger-200 rounded-md text-sm text-danger-700">{error}</div>}
            {info && <div role="status" className="mb-4 px-3 py-2.5 bg-success-50 border border-success-200 rounded-md text-sm text-success-700">{info}</div>}

            <form onSubmit={submit} className="space-y-4">
              {signup && (
                <Field label="Name" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" required />
              )}
              <Field label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
              <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                minLength={6} autoComplete={signup ? 'new-password' : 'current-password'}
                hint={signup ? 'At least 6 characters.' : null} required />
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
              </Button>
            </form>
          </div>

          <div className="mt-5 text-center">
            {apiKeyMode ? (
              <form onSubmit={useApiKey} className="text-left bg-surface border border-ink-200 rounded-lg p-5 space-y-3">
                <Field label="Anthropic API key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-…" className="font-mono text-xs" autoFocus required
                  hint="The same key always opens the same account. It’s also saved as your Anthropic key, so AI features work right away." />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={apiKeyBusy} className="flex-1">
                    {apiKeyBusy ? 'Signing in…' : 'Continue'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setApiKeyMode(false); setApiKey('') }}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setApiKeyMode(true)}
                className="text-sm text-ink-600 hover:text-ink-900 underline underline-offset-2 decoration-ink-300">
                Sign in with an Anthropic API key instead
              </button>
            )}
          </div>

          <p className="mt-10 text-sm text-ink-500 text-center">
            Want to look around first? <a href="/demo" className="text-link hover:underline underline-offset-2">Try the demo</a>
          </p>
        </div>
      </main>

      <footer className="py-6 text-xs text-ink-500 text-center space-x-4">
        <a href="/privacy.html" className="hover:text-ink-900 transition-colors">Privacy</a>
        <a href="/terms.html" className="hover:text-ink-900 transition-colors">Terms</a>
      </footer>
    </div>
  )
}

function Field({ label, hint, className = '', ...rest }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-800 mb-1.5">{label}</span>
      <Input className={`py-2 px-3 rounded-md border-ink-200 bg-surface ${className}`} {...rest} />
      {hint && <span className="block text-xs text-ink-500 mt-1.5 leading-relaxed">{hint}</span>}
    </label>
  )
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.44H12v4.62h6.48c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.86c2.26-2.08 3.58-5.16 3.58-8.83z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.86-3.02c-1.07.72-2.44 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.96H1.26v3.12C3.22 21.3 7.28 24 12 24z"/>
      <path fill="#FBBC05" d="M5.25 14.27a7.24 7.24 0 0 1 0-4.54V6.61H1.26a11.97 11.97 0 0 0 0 10.78l3.99-3.12z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.28 0 3.22 2.7 1.26 6.61l3.99 3.12C6.2 6.87 8.86 4.75 12 4.75z"/>
    </svg>
  )
}
