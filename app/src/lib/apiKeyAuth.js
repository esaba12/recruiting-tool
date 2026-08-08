import { supabase, authHeader } from './supabaseClient.js'

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// "Sign in with API key" — a zero-signup fast path for LoginPage.jsx. The key
// itself becomes the credential: it's hashed into a deterministic email +
// password pair, so pasting the same key always resolves to the same account
// (no separate password to invent or remember, no real email required). The
// raw key is only ever hashed client-side for this — Supabase Auth never sees
// it, only sha256(key) — but note this is still a single-factor scheme with no
// independent recovery path: whoever holds the raw key can sign in, and
// rotating the key permanently locks the original account out with no way to
// reset. SettingsTab.jsx's "Secure your account" section is the mitigation —
// it lets an account created this way add a real email+password or link
// Google once signed in, so a future key rotation doesn't strand it. First
// time through, that account doesn't exist yet, so sign-in fails and we
// transparently sign one up instead — Supabase's mailer_autoconfirm is on for
// this project, so signUp() returns an active session immediately, no email
// confirmation round-trip. Once signed in, the real key is saved as the
// account's Anthropic BYOK key via /api/keys, so the app is immediately
// usable with zero extra setup in Settings.
export async function signInWithApiKey(rawKey) {
  const key = (rawKey || '').trim()
  if (!key.startsWith('sk-ant-')) {
    throw new Error('That doesn\'t look like an Anthropic API key — it should start with "sk-ant-".')
  }

  const hash = await sha256Hex(key)
  const email = `key-${hash.slice(0, 24)}@byok.local`
  const password = hash

  const signInRes = await supabase.auth.signInWithPassword({ email, password })
  if (signInRes.error) {
    const signUpRes = await supabase.auth.signUp({
      email, password, options: { data: { full_name: 'API Key User' } },
    })
    if (signUpRes.error) throw signUpRes.error
    if (!signUpRes.data.session) {
      const retry = await supabase.auth.signInWithPassword({ email, password })
      if (retry.error) throw retry.error
    }
  }

  // Best-effort — if this hiccups, the user can still paste the same key into
  // Settings manually. Never block the sign-in itself on this.
  try {
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ provider: 'anthropic', apiKey: key }),
    })
    if (!res.ok) console.warn('Signed in, but saving the Anthropic key failed — add it in Settings.')
  } catch {
    console.warn('Signed in, but saving the Anthropic key failed — add it in Settings.')
  }
}
