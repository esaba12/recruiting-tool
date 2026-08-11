// Google redirects the user's browser here after they approve (or deny) calendar access —
// a plain top-level GET, so this can't carry a Supabase Authorization header. Instead it
// trusts the `state` google-oauth-start.js minted (AES-256-GCM, same key as every other
// secret this app encrypts at rest), which is what makes this safe: forging a valid state
// would require the server's own SECRET_ENCRYPTION_KEY.
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { encrypt, decrypt } from './_lib/crypto.js'
import { CALENDAR_SLOTS, redirectUri } from './_lib/googleOAuth.js'

function errorPage(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/html' })
  res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem;max-width:32rem;margin:0 auto">
    <h2>Couldn't connect that calendar</h2><p>${message}</p><p><a href="/">Back to Recruiting OS</a></p>
  </body></html>`)
}

async function exchangeCode(code, req) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(req),
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || `Token exchange failed (${res.status})`)
  return data
}

async function fetchEmail(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.email || null
  } catch { return null }
}

export default async function handler(req, res) {
  const { code, error, state } = req.query

  if (error) return errorPage(res, 400, `Google said: ${error}`)
  if (!code || !state) return errorPage(res, 400, 'Missing code or state from Google\'s redirect.')

  let parsed
  try {
    parsed = JSON.parse(decrypt(state))
  } catch {
    return errorPage(res, 400, 'This connection link is invalid or was tampered with. Go back to Settings and try again.')
  }
  const { userId, slot, exp } = parsed
  if (!userId || !CALENDAR_SLOTS[slot]) return errorPage(res, 400, 'Malformed connection request.')
  if (!exp || Date.now() > exp) return errorPage(res, 400, 'This connection link expired. Go back to Settings and try again.')

  let tokens
  try {
    tokens = await exchangeCode(code, req)
  } catch (e) {
    return errorPage(res, 502, e.message)
  }
  if (!tokens.refresh_token) {
    return errorPage(res, 400, 'Google didn\'t return a refresh token — it only issues one the first time you grant this app access. Revoke access for this app at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a> and try connecting again.')
  }

  const email = tokens.access_token ? await fetchEmail(tokens.access_token) : null

  const { error: dbError } = await supabaseAdmin().from('google_calendar_tokens').upsert({
    user_id: userId,
    slot,
    refresh_token_ciphertext: encrypt(tokens.refresh_token),
    connected_email: email,
  }, { onConflict: 'user_id,slot' })
  if (dbError) return errorPage(res, 500, dbError.message)

  res.writeHead(302, { Location: '/' })
  res.end()
}
