// Client-side error reporting (v1.2 spec 07). A no-op unless VITE_SENTRY_DSN is set at
// build time, so local dev and forks send nothing. Deliberately minimal and scrubbed:
// - user context is the Supabase user id only (no email);
// - no tracing, no session replay (replay would record pasted API keys and email bodies);
// - request bodies, query strings, and console breadcrumbs are dropped, since those are
//   where BYOK keys, OAuth codes, `?email=` params, and email contents could show up.
import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN
let enabled = false

const stripQuery = url => (typeof url === 'string' ? url.split('?')[0] : url)

export function scrubEvent(event) {
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.headers
    delete event.request.query_string
    event.request.url = stripQuery(event.request.url)
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined
  return event
}

export function scrubBreadcrumb(crumb) {
  if (crumb.category === 'console') return null
  if (crumb.data?.url && /\/api\/keys\b/.test(crumb.data.url)) return null
  if (crumb.data?.url) crumb.data = { ...crumb.data, url: stripQuery(crumb.data.url) }
  if (crumb.category === 'navigation' && crumb.data) {
    crumb.data = { ...crumb.data, from: stripQuery(crumb.data.from), to: stripQuery(crumb.data.to) }
  }
  return crumb
}

// Sentry v11 replaced sendDefaultPii with dataCollection, and an unset dataCollection collects
// user info, cookies, headers, bodies and query params (2026-11-27). Everything is off; the
// scrubbers above stay the backstop since key-name filtering is only best effort.
export const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
}

export function initSentry() {
  if (!DSN || enabled) return
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || undefined,
    dataCollection: DATA_COLLECTION,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  })
  enabled = true
}

export function setSentryUser(userId) {
  if (enabled) Sentry.setUser(userId ? { id: userId } : null)
}

export function reportError(error, context) {
  if (enabled) Sentry.captureException(error, context ? { extra: context } : undefined)
}
