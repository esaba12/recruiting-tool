import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { authHeader, supabase } from '../lib/supabaseClient.js'
import { connectGoogleCalendar, disconnectGoogleCalendar, getGoogleCalendarStatus, linkGoogleIdentity } from '../lib/googleAuth.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import { Badge } from '../shared.jsx'

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', hint: 'console.anthropic.com/settings/keys', href: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', label: 'OpenAI (GPT)', hint: 'platform.openai.com/api-keys', href: 'https://platform.openai.com/api-keys' },
  { id: 'exa', label: 'Exa (people/company discovery)', hint: 'dashboard.exa.ai/api-keys', href: 'https://dashboard.exa.ai/api-keys' },
  { id: 'github', label: 'GitHub token (optional — raises rate limits)', hint: 'github.com/settings/tokens', href: 'https://github.com/settings/tokens' },
]

const SCHOOLS_HINT = 'e.g. University of Michigan'

export default function SettingsTab() {
  const { profile, refreshProfile, signOut, user } = useAuth()
  const [keys, setKeys] = useState([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [drafts, setDrafts] = useState({})
  const [savingProvider, setSavingProvider] = useState(null)
  const [calStatus, setCalStatus] = useState({ connected: false, email: null })
  const [profileForm, setProfileForm] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [error, setError] = useState(null)

  const isApiKeyAccount = !!user?.email?.endsWith('@byok.local')
  const hasGoogleIdentity = !!user?.identities?.some(i => i.provider === 'google')
  const [recoveryPassword, setRecoveryPassword] = useState('')
  const [savingRecovery, setSavingRecovery] = useState(false)
  const [recoveryInfo, setRecoveryInfo] = useState(null)
  const [linkingGoogle, setLinkingGoogle] = useState(false)

  const loadKeys = useCallback(async () => {
    setKeysLoading(true)
    try {
      const res = await fetch('/api/keys', { headers: await authHeader() })
      if (res.ok) setKeys(await res.json())
    } finally {
      setKeysLoading(false)
    }
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])
  useEffect(() => { getGoogleCalendarStatus().then(setCalStatus) }, [])
  useEffect(() => {
    if (profile) setProfileForm({
      full_name: profile.full_name || '',
      school: profile.school || '',
      grad_year: profile.grad_year || '',
      focus: profile.focus || 'SWE',
      ai_provider: profile.ai_provider || 'claude',
    })
  }, [profile])

  async function saveKey(provider) {
    const apiKey = (drafts[provider] || '').trim()
    if (!apiKey) return
    setSavingProvider(provider); setError(null)
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ provider, apiKey }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message || 'Failed to save key')
      setDrafts(d => ({ ...d, [provider]: '' }))
      await loadKeys()
    } catch (e) { setError(e.message) }
    finally { setSavingProvider(null) }
  }

  async function removeKey(provider) {
    setSavingProvider(provider); setError(null)
    try {
      const res = await fetch(`/api/keys?provider=${provider}`, { method: 'DELETE', headers: await authHeader() })
      if (!res.ok) throw new Error('Failed to remove key')
      await loadKeys()
    } catch (e) { setError(e.message) }
    finally { setSavingProvider(null) }
  }

  async function saveProfile() {
    setSavingProfile(true); setError(null)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: profileForm.full_name || null,
        school: profileForm.school || null,
        grad_year: profileForm.grad_year ? Number(profileForm.grad_year) : null,
        focus: profileForm.focus,
        ai_provider: profileForm.ai_provider,
      }).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
    } catch (e) { setError(e.message) }
    finally { setSavingProfile(false) }
  }

  // Password-only on purpose — this project's auth config has double_confirm_changes
  // enabled, which requires confirming an email change via BOTH the old and new
  // address. This account's old address (key-<hash>@byok.local) can't receive mail,
  // so an email change would sit permanently pending. A password-only update has no
  // such confirmation step (secure_password_change is off), so it applies instantly.
  // The system email stays as the fallback login identifier — shown read-only above
  // so the user can pair it with this password to sign in without their API key.
  async function saveRecoveryCredentials(e) {
    e.preventDefault()
    setSavingRecovery(true); setError(null); setRecoveryInfo(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword })
      if (error) throw error
      setRecoveryPassword('')
      setRecoveryInfo('Password set. Save your account email above + this password somewhere safe — that combination now works even without your API key.')
    } catch (e) { setError(e.message) }
    finally { setSavingRecovery(false) }
  }

  async function linkGoogle() {
    setLinkingGoogle(true); setError(null)
    try {
      await linkGoogleIdentity() // redirects away; returns to Settings on success
    } catch (e) { setError(e.message); setLinkingGoogle(false) }
  }

  async function toggleCalendar() {
    if (calStatus.connected) {
      await disconnectGoogleCalendar()
      setCalStatus({ connected: false, email: null })
    } else {
      await connectGoogleCalendar() // redirects away — status refreshes on return
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-ink-900">Settings</h2>
        <p className="text-sm text-ink-400 mt-0.5">Signed in as {user?.email}</p>
      </div>

      {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-700">{error}</div>}

      {/* Account recovery — only shown for accounts created via "sign in with API key"
          (apiKeyAuth.js), where the Anthropic key itself doubles as the account password
          with no real email behind it. Rotating that key with no recovery method set up
          here means permanent lockout, so this is surfaced as a warning, not a footnote. */}
      {isApiKeyAccount && (
        <section className="bg-warning-50 rounded-2xl border border-warning-200 p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">⚠ Secure your account</h3>
            <p className="text-xs text-ink-500 mt-0.5">
              You signed in with an Anthropic API key — that key is currently your only way back into this account.
              If you ever rotate or revoke it, you'll lose access for good. Fix that with either option below
              (linking Google is simpler and takes one click).
            </p>
          </div>
          {recoveryInfo && <p className="text-xs text-success-700">{recoveryInfo}</p>}

          <div>
            {hasGoogleIdentity ? (
              <Badge label="Google linked — you're covered" color="bg-success-50 text-success-700" />
            ) : (
              <Button size="sm" variant="secondary" onClick={linkGoogle} disabled={linkingGoogle}>
                {linkingGoogle ? 'Redirecting...' : 'Link Google account'}
              </Button>
            )}
          </div>

          <div className="pt-2 border-t border-warning-200/60 space-y-2">
            <p className="text-xs text-ink-400">Or set a password. Your account's login email (save it too):</p>
            <Input readOnly value={user?.email || ''} className="font-mono text-xs bg-ink-50 cursor-text" onFocus={e => e.target.select()} />
            <form onSubmit={saveRecoveryCredentials} className="flex gap-2">
              <Input type="password" placeholder="Choose a password" value={recoveryPassword}
                onChange={e => setRecoveryPassword(e.target.value)} minLength={6} required className="flex-1" />
              <Button type="submit" size="sm" disabled={savingRecovery}>
                {savingRecovery ? 'Saving...' : 'Set password'}
              </Button>
            </form>
          </div>
        </section>
      )}

      {/* Profile / onboarding */}
      <section className="bg-white rounded-2xl border border-ink-100 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink-900">Your profile</h3>
        <p className="text-xs text-ink-400">Used to personalize AI prompts (company ranking, outreach drafts, discovery scoring) instead of hardcoded defaults.</p>
        {profileForm && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
            <Input label="School" placeholder={SCHOOLS_HINT} value={profileForm.school} onChange={e => setProfileForm(f => ({ ...f, school: e.target.value }))} />
            <Input label="Grad year" type="number" value={profileForm.grad_year} onChange={e => setProfileForm(f => ({ ...f, grad_year: e.target.value }))} />
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">Focus</label>
              <select value={profileForm.focus} onChange={e => setProfileForm(f => ({ ...f, focus: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-ink-100 rounded-lg text-sm focus:outline-none focus:border-accent-400">
                <option value="SWE">SWE</option>
                <option value="PM">PM</option>
                <option value="Both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">AI provider</label>
              <select value={profileForm.ai_provider} onChange={e => setProfileForm(f => ({ ...f, ai_provider: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-ink-100 rounded-lg text-sm focus:outline-none focus:border-accent-400">
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">GPT (OpenAI)</option>
              </select>
            </div>
          </div>
        )}
        <Button size="sm" onClick={saveProfile} disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save profile'}</Button>
      </section>

      {/* BYOK keys */}
      <section className="bg-white rounded-2xl border border-ink-100 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">Your API keys</h3>
          <p className="text-xs text-ink-400 mt-0.5">Bring your own keys — encrypted at rest, never shared, never billed to anyone but you. Stored server-side only; the browser never sees them again after you save.</p>
        </div>
        {keysLoading ? <p className="text-xs text-ink-400">Loading...</p> : PROVIDERS.map(p => {
          const state = keys.find(k => k.provider === p.id)
          return (
            <div key={p.id} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-ink-400 mb-0.5">
                  {p.label}{' '}
                  <a href={p.href} target="_blank" rel="noreferrer" className="text-accent-500 hover:underline">({p.hint})</a>
                </label>
                <input
                  type="password"
                  placeholder={state?.hasKey ? `Saved — ends in ${state.last4}` : 'Paste your key'}
                  value={drafts[p.id] || ''}
                  onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-ink-100 rounded-lg text-sm focus:outline-none focus:border-accent-400"
                />
              </div>
              {state?.hasKey && <Badge label="Connected" color="bg-success-50 text-success-700" />}
              <Button size="sm" variant="secondary" onClick={() => saveKey(p.id)} disabled={savingProvider === p.id || !drafts[p.id]}>
                Save
              </Button>
              {state?.hasKey && (
                <Button size="sm" variant="ghost" onClick={() => removeKey(p.id)} disabled={savingProvider === p.id}>
                  Remove
                </Button>
              )}
            </div>
          )
        })}
      </section>

      {/* Google Calendar */}
      <section className="bg-white rounded-2xl border border-ink-100 p-5 space-y-2">
        <h3 className="text-sm font-semibold text-ink-900">Google Calendar</h3>
        <p className="text-xs text-ink-400">Powers the "+ Event" screenshot/text → calendar event feature.</p>
        <div className="flex items-center gap-2">
          {calStatus.connected
            ? <Badge label={`Connected${calStatus.email ? ` (${calStatus.email})` : ''}`} color="bg-success-50 text-success-700" />
            : <Badge label="Not connected" color="bg-ink-100 text-ink-500" />}
          <Button size="sm" variant={calStatus.connected ? 'ghost' : 'secondary'} onClick={toggleCalendar}>
            {calStatus.connected ? 'Disconnect' : 'Connect Google Calendar'}
          </Button>
        </div>
      </section>

      <Button variant="ghost" onClick={signOut}>Sign out</Button>
    </div>
  )
}
