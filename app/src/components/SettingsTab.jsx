import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { authHeader, supabase } from '../lib/supabaseClient.js'
import { connectGoogleCalendar, disconnectGoogleCalendar, getGoogleCalendarStatus, linkGoogleIdentity, connectGmail, listGmailConnections, disconnectGmail } from '../lib/googleAuth.js'
import { CALENDAR_SLOTS } from '../googleCalendar.js'
import { fetchSchools, getUserSetting, setUserSetting } from '../db.js'
import { SYNC_SETTING_KEY, DEFAULT_SYNC } from '../lib/useEventCalendarSync.js'
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
  const [calStatus, setCalStatus] = useState(() => Object.fromEntries(Object.keys(CALENDAR_SLOTS).map(k => [k, { connected: false, email: null }])))
  const [connectingSlot, setConnectingSlot] = useState(null)
  const [gmailConnections, setGmailConnections] = useState([])
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [profileForm, setProfileForm] = useState(null)
  const [schools, setSchools] = useState([])
  const [syncSetting, setSyncSetting] = useState(null)
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
  useEffect(() => {
    Object.keys(CALENDAR_SLOTS).forEach(slot => {
      getGoogleCalendarStatus(slot).then(status => setCalStatus(cs => ({ ...cs, [slot]: status })))
    })
    fetchSchools().then(setSchools).catch(() => setSchools([]))
    getUserSetting(SYNC_SETTING_KEY).then(v => setSyncSetting({ ...DEFAULT_SYNC, ...(v || {}) })).catch(() => setSyncSetting(DEFAULT_SYNC))
    listGmailConnections().then(setGmailConnections).catch(() => setGmailConnections([]))
  }, [])
  useEffect(() => {
    if (profile) setProfileForm({
      full_name: profile.full_name || '',
      school: profile.school || '',
      school_id: profile.school_id || '',
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
        // Campus for the shared Recruiting Events pool — resolved from the typed
        // school name when it matches a known campus, else left as-is.
        school_id: profileForm.school_id || null,
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

  async function updateSync(patch) {
    const next = { ...DEFAULT_SYNC, ...(syncSetting || {}), ...patch }
    setSyncSetting(next)
    try { await setUserSetting(SYNC_SETTING_KEY, next) } catch (e) { setError(e.message) }
  }

  async function toggleCalendar(slot) {
    if (calStatus[slot]?.connected) {
      await disconnectGoogleCalendar(slot)
      setCalStatus(cs => ({ ...cs, [slot]: { connected: false, email: null } }))
    } else {
      setConnectingSlot(slot); setError(null)
      try {
        await connectGoogleCalendar(slot) // redirects away on success — status refreshes on return
      } catch (e) {
        setError(e.message)
        setConnectingSlot(null)
      }
    }
  }

  async function handleConnectGmail() {
    setConnectingGmail(true); setError(null)
    try {
      await connectGmail() // redirects away on success — connections list refreshes on return
    } catch (e) {
      setError(e.message)
      setConnectingGmail(false)
    }
  }

  async function handleDisconnectGmail(email) {
    try {
      await disconnectGmail(email)
      setGmailConnections(cs => cs.filter(c => c.email !== email))
    } catch (e) {
      setError(e.message)
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
            <div>
              <Input label="School" placeholder={SCHOOLS_HINT} list="settings-schools" value={profileForm.school}
                onChange={e => {
                  const school = e.target.value
                  const match = schools.find(s => s.name.toLowerCase() === school.trim().toLowerCase() || s.slug === school.trim().toLowerCase())
                  setProfileForm(f => ({ ...f, school, school_id: match ? match.id : '' }))
                }} />
              <datalist id="settings-schools">{schools.map(s => <option key={s.id} value={s.name} />)}</datalist>
              <p className="text-[11px] text-ink-400 mt-0.5">
                {profileForm.school_id
                  ? `Events pool: ${schools.find(s => s.id === profileForm.school_id)?.name || 'linked campus'}`
                  : 'Pick a listed campus to see its shared recruiting events.'}
              </p>
            </div>
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

      {/* Networking email accounts — any number of connected Gmail accounts, scanned
          periodically for recruiting/networking signals (contacts, applications, follow-up
          action items). See api/_lib/emailPipeline.js. */}
      <section className="bg-white rounded-2xl border border-ink-100 p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">Networking Email Accounts</h3>
          <p className="text-xs text-ink-400">
            Connect any Gmail account (personal, school, work) to automatically track contacts, applications, and
            follow-up steps from your email — no setup beyond this one click.
          </p>
        </div>
        {!keys.find(k => k.provider === 'anthropic')?.hasKey && (
          <p className="text-[11px] text-warning-700 bg-warning-50 border border-warning-200 rounded-lg px-2.5 py-1.5">
            ⚠ Add your Anthropic key above first — scanning uses it to classify your email and silently skips
            any connected account until one is set.
          </p>
        )}
        {gmailConnections.map(c => (
          <div key={c.email} className="flex items-center gap-2">
            <Badge label={c.email} color="bg-success-50 text-success-700" />
            <span className="text-[11px] text-ink-400">
              {c.lastScannedAt ? `Last scanned ${new Date(c.lastScannedAt).toLocaleString()}` : 'Not scanned yet'}
            </span>
            <Button size="sm" variant="ghost" onClick={() => handleDisconnectGmail(c.email)}>Disconnect</Button>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={handleConnectGmail} disabled={connectingGmail}>
          {connectingGmail ? 'Redirecting...' : '+ Connect another Gmail account'}
        </Button>
      </section>

      {/* Google Calendar — up to two independent connections (e.g. a personal Gmail
          account and a separate school Google account), each its own OAuth grant. */}
      <section className="bg-white rounded-2xl border border-ink-100 p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">Google Calendar</h3>
          <p className="text-xs text-ink-400">Powers the "+ Event" screenshot/text → calendar event feature and the Calendar tab. Connect a second account for a school calendar separate from your personal one.</p>
        </div>
        {Object.entries(CALENDAR_SLOTS).map(([slot, label]) => {
          const status = calStatus[slot] || { connected: false, email: null }
          const needsReconnect = status.connected && !status.canManageCalendars && syncSetting?.enabled && syncSetting.slot === slot
          return (
            <div key={slot}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink-600 w-14 shrink-0">{label}</span>
                {status.connected
                  ? <Badge label={`Connected${status.email ? ` (${status.email})` : ''}`} color="bg-success-50 text-success-700" />
                  : <Badge label="Not connected" color="bg-ink-100 text-ink-500" />}
                <Button size="sm" variant={status.connected ? 'ghost' : 'secondary'} onClick={() => toggleCalendar(slot)} disabled={connectingSlot === slot}>
                  {connectingSlot === slot ? 'Redirecting...' : status.connected ? 'Disconnect' : `Connect ${label}`}
                </Button>
              </div>
              {needsReconnect && (
                <p className="text-[11px] text-warning-700 pl-16 mt-1">
                  ⚠ Reconnect this account to enable the Recruiting calendar — your existing grant predates the calendar-management permission.
                </p>
              )}
            </div>
          )
        })}
        {/* Recruiting Events → dedicated "Recruiting" calendar (never primary). */}
        <div className="pt-3 border-t border-ink-100 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-ink-700">Recruiting calendar sync</p>
              <p className="text-[11px] text-ink-400">Pushes high-relevance events plus a reminder per signup step and follow-up to a separate "Recruiting" calendar this app creates.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-600 shrink-0">
              <input type="checkbox" checked={!!syncSetting?.enabled} onChange={e => updateSync({ enabled: e.target.checked })} />
              Enabled
            </label>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-500">Lives on</span>
            <select value={syncSetting?.slot || 'personal'} onChange={e => updateSync({ slot: e.target.value })}
              className="px-2 py-1 border border-ink-100 rounded-md text-xs focus:outline-none focus:border-accent-400">
              {Object.entries(CALENDAR_SLOTS).map(([slot, label]) => <option key={slot} value={slot}>{label}{calStatus[slot]?.connected ? '' : ' (not connected)'}</option>)}
            </select>
          </div>
        </div>
      </section>

      <Button variant="ghost" onClick={signOut}>Sign out</Button>
    </div>
  )
}
