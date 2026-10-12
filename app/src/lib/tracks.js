// Recruiting tracks — the one place that reads a profile's track selection.
// `profiles.tracks` (text[]) replaced the single `profiles.focus` ('SWE' | 'PM' |
// 'Both'); profileTracks() falls back to the legacy column so an un-migrated row
// (or a rolled-back frontend) still behaves. Nothing else should read `.focus`.

export const TRACKS = [
  { id: 'swe',        label: 'Software engineering',        short: 'SWE' },
  { id: 'pm',         label: 'Product management',          short: 'PM' },
  { id: 'ib',         label: 'Investment banking / finance', short: 'IB / Finance' },
  { id: 'quant',      label: 'Quant / trading',             short: 'Quant' },
  { id: 'consulting', label: 'Consulting',                  short: 'Consulting' },
]

const TRACK_IDS = new Set(TRACKS.map(t => t.id))
const LEGACY_FOCUS = { SWE: ['swe'], PM: ['pm'], Both: ['swe', 'pm'] }

export function profileTracks(profile) {
  const tracks = (profile?.tracks || []).filter(t => TRACK_IDS.has(t))
  if (tracks.length) return tracks
  return LEGACY_FOCUS[profile?.focus] || ['swe']
}

export function hasTrack(profile, id) {
  return profileTracks(profile).includes(id)
}

// True when every track is a tech one — the surfaces built on GitHub job boards
// and the YC directory only make sense then.
export function isTechOnly(profile) {
  return profileTracks(profile).every(t => t === 'swe' || t === 'pm')
}

// "SWE + IB / Finance" — for prompts and copy.
export function tracksLabel(profile) {
  const byId = new Map(TRACKS.map(t => [t.id, t.short]))
  return profileTracks(profile).map(t => byId.get(t)).join(' + ')
}

// GitHub-README internship boards and the YC company directory are tech-only sources —
// Pipeline's Job Boards view and Grow's YC candidate pool show only for these users.
export function usesTechSources(profile) {
  return hasTrack(profile, 'swe') || hasTrack(profile, 'pm')
}

// Pipeline stages stay the same stored values for everyone (stats, funnel, and the email
// pipeline key off them); users with a non-tech track see their industry's names too.
const STAGE_ALIASES = {
  'Phone Screen': 'Phone Screen / HireVue / 1st round',
  Technical: 'Technical / 2nd round',
  Onsite: 'Onsite / Superday / Final round',
}
export function stageLabel(stage, profile) {
  return !isTechOnly(profile) && STAGE_ALIASES[stage] ? STAGE_ALIASES[stage] : stage
}
