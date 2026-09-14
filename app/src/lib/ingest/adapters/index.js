// Adapter registry — one entry per event PLATFORM. A school row's
// feed_config.sources[] names the adapter by `kind` plus its parameters, so
// adding a campus (or a second feed at one campus) is a config row, not code.
//
// Interface every adapter exports (pure, no I/O — fetching is the server's job
// so the trust boundary stays in api/_lib/eventsIngest.js):
//   kind                      — matches feed_config.sources[].kind and events.source_kind
//   feedUrl(source)           — the URL to GET, or null if the source is misconfigured
//   feedHost(source)          — host every item's permalink must match (relay validation)
//   normalize(payload, ctx)   — { drafts: EventDraft[], shape, rejected }
//
// Stubs below reserve the names for SSO-gated platforms. They deliberately have
// no fetch path: Career Fair Plus / Handshake / 12twenty / Symplicity sit behind
// campus SSO, and we never scrape authenticated sessions or store portal
// credentials. Those platforms enter the pool via paste/CSV/ICS import (Phase 13)
// — the same `normalize → validate → dedup → commit` pipeline, different entry.
// An official API can slot in later by filling `feedUrl` + `normalize`.
import localist from './localist.js'

function stub(kind, note) {
  return {
    kind, feedUrl: () => null, feedHost: () => null,
    normalize: () => ({ drafts: [], shape: null, rejected: 0 }),
    unsupported: note,
  }
}

export const ADAPTERS = {
  localist,
  careerfairplus: stub('careerfairplus', 'SSO-gated — use paste-import'),
  handshake: stub('handshake', 'SSO-gated — use paste-import'),
  twelvetwenty: stub('twelvetwenty', 'SSO-gated — use paste-import'),
  symplicity: stub('symplicity', 'SSO-gated — use paste-import'),
}

export function adapterFor(kind) {
  return ADAPTERS[kind] || null
}

// Flatten a school's feed_config into runnable source descriptors.
export function sourcesFor(school) {
  const list = school?.feedConfig?.sources || school?.feed_config?.sources || []
  return list.map((s, i) => {
    const adapter = adapterFor(s.kind)
    const url = adapter ? adapter.feedUrl(s) : null
    return {
      ...s,
      ref: s.ref || String(s.groupId ?? s.url ?? i),
      label: s.label || `${s.kind} ${s.groupId ?? ''}`.trim(),
      url,
      host: adapter ? adapter.feedHost(s) : null,
      supported: !!(adapter && url && !adapter.unsupported),
      unsupported: adapter?.unsupported || (!adapter ? `unknown adapter '${s.kind}'` : (!url ? 'misconfigured (no URL)' : null)),
    }
  })
}
