// Consolidated Gmail networking-pipeline endpoint — folds what would otherwise be 4
// separate files (oauth-start, oauth-callback, connect status/disconnect, scan) into one,
// to stay under Vercel Hobby's 12-serverless-function cap. Routed by request shape, not a
// single concern per file:
//   GET  ?code=...|error=...          -> OAuth callback (Google's redirect target, unauthenticated)
//   POST (x-cron-secret header)       -> periodic scan (external pinger, unauthenticated)
//   GET  ?action=start                -> requireUser() -> kick off the OAuth redirect
//   GET  (no action)                  -> requireUser() -> list this user's connections
//   DELETE ?email=...                 -> requireUser() -> disconnect one connection
import crypto from 'crypto'
import { requireUser, supabaseAdmin } from './_lib/supabaseAdmin.js'
import { encrypt, decrypt } from './_lib/crypto.js'
import { checkRateLimit, sendRateLimited } from './_lib/rateLimit.js'
import { GMAIL_OAUTH_SCOPE, gmailRedirectUri, escapeHtml, issueOAuthNonce, consumeOAuthNonce, baseUrl } from './_lib/googleOAuth.js'
import { scanGmailConnection, orderConnections } from './_lib/emailPipeline.js'
import { runUserPushes, pushSettingsFor, sendPush } from './_lib/pushes.js'
import { getUserKey } from './_lib/keys.js'

const STATE_TTL_MS = 10 * 60 * 1000
const SCAN_COOLDOWN_MS = 9 * 60 * 1000 // slightly under the ~10-min pinger interval
// Vercel kills the function at 300 s. Stop starting threads at 240 s and stop starting
// mailboxes 30 s before that, so every result gets saved (v1.3 spec 10).
const SCAN_BUDGET_MS = 240 * 1000
const NEW_CONNECTION_MARGIN_MS = 30 * 1000

function errorPage(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/html' })
  res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem;max-width:32rem;margin:0 auto">
    <h2>Couldn't connect that Gmail account</h2><p>${escapeHtml(message)}</p><p><a href="/">Back to Recruiting OS</a></p>
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
      redirect_uri: gmailRedirectUri(req),
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

async function handleOauthCallback(req, res) {
  const { code, error, state } = req.query
  if (error) return errorPage(res, 400, `Google said: ${error}`)
  if (!code || !state) return errorPage(res, 400, 'Missing code or state from Google\'s redirect.')

  let parsed
  try {
    parsed = JSON.parse(decrypt(state))
  } catch {
    return errorPage(res, 400, 'This connection link is invalid or was tampered with. Go back to Settings and try again.')
  }
  const { userId, nonce, exp } = parsed
  if (!userId) return errorPage(res, 400, 'Malformed connection request.')
  if (!exp || Date.now() > exp) return errorPage(res, 400, 'This connection link expired. Go back to Settings and try again.')
  if (!consumeOAuthNonce(req, res, 'gmail_oauth_nonce', nonce)) {
    return errorPage(res, 400, 'This connection wasn\'t started from this browser. Go back to Settings and click Connect again.')
  }

  let tokens
  try {
    tokens = await exchangeCode(code, req)
  } catch (e) {
    return errorPage(res, 502, e.message)
  }
  if (!tokens.refresh_token) {
    return errorPage(res, 400, 'Google didn\'t return a refresh token — it only issues one the first time you grant this app access. Revoke access for this app at myaccount.google.com/permissions and try connecting again.')
  }

  const email = tokens.access_token ? await fetchEmail(tokens.access_token) : null
  if (!email) return errorPage(res, 502, 'Couldn\'t determine which Gmail address you connected — try again.')

  const { error: dbError } = await supabaseAdmin().from('gmail_tokens').upsert({
    user_id: userId,
    connected_email: email,
    refresh_token_ciphertext: encrypt(tokens.refresh_token),
  }, { onConflict: 'user_id,connected_email' })
  if (dbError) return errorPage(res, 500, dbError.message)

  res.writeHead(302, { Location: '/' })
  res.end()
}

async function handleScan(req, res) {
  const secret = String(req.headers['x-cron-secret'] || '')
  const expected = process.env.CRON_SECRET || ''
  const ok = expected && secret.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
  if (!ok) {
    return res.status(401).json({ error: { message: 'Not authorized' } })
  }

  const db = supabaseAdmin()
  const { data: connections, error } = await db.from('gmail_tokens').select('*')
  if (error) return res.status(500).json({ error: { message: error.message } })

  const deadline = Date.now() + SCAN_BUDGET_MS
  const results = []
  // Every user with a connection gets a push pass, even if their scan was skipped this tick:
  // the digests are time-based, not mail-based.
  const pushesByUser = new Map((connections || []).map(c => [c.user_id, []]))
  for (const conn of orderConnections(connections || [])) {
    if (Date.now() >= deadline - NEW_CONNECTION_MARGIN_MS) {
      results.push({ email: conn.connected_email, skipped: 'budget' })
      continue
    }
    const sinceLastMs = conn.last_scanned_at ? Date.now() - new Date(conn.last_scanned_at).getTime() : Infinity
    if (sinceLastMs < SCAN_COOLDOWN_MS) {
      results.push({ email: conn.connected_email, skipped: 'cooldown' })
      continue
    }
    try {
      const { threadProgress, scanned, failed, partial, cursor, skipped, pushes = [] } = await scanGmailConnection(conn, { deadline })
      pushesByUser.get(conn.user_id).push(...pushes)
      await db.from('gmail_tokens')
        .update({ thread_progress: threadProgress, scan_cursor: cursor ?? null, last_scanned_at: new Date().toISOString() })
        .eq('id', conn.id)
      results.push({ email: conn.connected_email, scanned, failed, partial, cursor, ...(skipped ? { skipped } : {}) })
    } catch (e) {
      results.push({ email: conn.connected_email, error: e.message })
    }
  }
  const pushes = []
  for (const [userId, newPushes] of pushesByUser) {
    if (Date.now() >= deadline) { pushes.push({ skipped: 'budget' }); continue }
    try {
      const anthropicKey = await getUserKey(userId, 'anthropic')
      pushes.push(await runUserPushes(db, userId, newPushes, { anthropicKey, click: baseUrl(req) }))
    } catch (e) {
      pushes.push({ error: e.message })
    }
  }
  res.status(200).json({ results, pushes })
}

export default async function handler(req, res) {
  // Google's redirect always carries `code` (success) or `error` (denied) — never hit by
  // the browser-originated requests below, which never set either.
  if (req.query.code || req.query.error) return handleOauthCallback(req, res)

  // The external pinger — no user session in this context, gated by shared secret instead.
  if (req.method === 'POST' && req.query.action !== 'test-push') return handleScan(req, res)

  // Everything else is a browser-originated, authenticated request.
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  if (req.method === 'GET' && req.query.action === 'start') {
    const nonce = issueOAuthNonce(req, res, 'gmail_oauth_nonce')
    const state = encrypt(JSON.stringify({ userId: user.id, nonce, exp: Date.now() + STATE_TTL_MS }))
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: gmailRedirectUri(req),
      response_type: 'code',
      scope: GMAIL_OAUTH_SCOPE,
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
    })}`
    return res.status(200).json({ authUrl })
  }

  const rl = await checkRateLimit(user.id, 'CRUD')
  if (rl.limited) return sendRateLimited(res, rl.retryAfter)

  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db.from('gmail_tokens')
      .select('connected_email, last_scanned_at').eq('user_id', user.id).order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json((data || []).map(r => ({ email: r.connected_email, lastScannedAt: r.last_scanned_at })))
  }

  // Settings → "Send a test push": proves the saved ntfy topic reaches the user's phone.
  if (req.method === 'POST' && req.query.action === 'test-push') {
    const settings = await pushSettingsFor(db, user.id)
    if (!settings) return res.status(400).json({ error: { message: 'Save an ntfy topic first' } })
    const sent = await sendPush(settings.ntfyTopic, {
      title: '✅ Test push', message: 'Recruiting OS push notifications are working.', tags: ['white_check_mark'], click: baseUrl(req),
    })
    return sent ? res.status(200).json({ sent: true }) : res.status(502).json({ error: { message: 'ntfy.sh did not accept the push' } })
  }

  if (req.method === 'DELETE') {
    const email = req.query.email
    if (!email) return res.status(400).json({ error: { message: 'email is required' } })
    const { error } = await db.from('gmail_tokens').delete().eq('user_id', user.id).eq('connected_email', email)
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json({ disconnected: true })
  }

  res.setHeader('Allow', 'GET, DELETE, POST')
  return res.status(405).json({ error: { message: 'Method not allowed' } })
}
