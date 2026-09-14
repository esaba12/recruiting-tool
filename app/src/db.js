// Multi-tenant data layer — replaces the old notion.js (which hardcoded one
// person's Notion workspace DB IDs). Every table is scoped by user_id + RLS
// (see supabase/migrations/*_init.sql), so this file never needs to filter by
// user itself — Postgres does it via `auth.uid() = user_id` policies, keyed
// off the signed-in user's session that lib/supabaseClient.js's `supabase`
// client already carries. Every exported function here keeps the EXACT same
// name/signature/return shape as the old notion.js so every component that
// imported it (ContactDetailModal, LogInteractionModal, PipelineTab, etc.)
// needed zero changes beyond the import path.
import { supabase } from './lib/supabaseClient.js'
import {
  DEMO_CONTACTS, DEMO_APPLICATIONS, DEMO_INTERACTIONS, DEMO_CALLS, DEMO_CONTACT_RELATIONSHIPS, nextDemoId,
  DEMO_SCHOOLS, DEMO_EMPLOYERS, DEMO_EVENTS, DEMO_USER_EVENTS, DEMO_EVENT_RELEVANCE, DEMO_REQUIREMENT_COMPLETIONS, DEMO_INGEST_SOURCES,
} from './demoData.js'
import { ROLE_OPTIONS } from './shared.jsx'

function todayStr() { return new Date().toISOString().split('T')[0] }
function plusDays(n) { return new Date(Date.now() + n * 86400000).toISOString().split('T')[0] }
function daysBetween(a, b) { return Math.floor((a.getTime() - b.getTime()) / 86400000) }

function throwIfError(error, action) {
  if (error) throw new Error(`${action}: ${error.message}`)
}

// ── Demo mode (public /demo route — see App.jsx's DemoApp, no sign-in) ─────────
//
// Every exported function below checks isDemoMode() first and, if true, reads/writes an
// in-memory clone of demoData.js instead of ever touching Supabase — so a visitor to
// /demo gets a fully working CRM (add a contact, log an interaction, drag an application
// between stages) with zero backend calls and zero real auth. State lives in module-level
// arrays seeded lazily on first access and resets on page reload — deliberate: a shared
// public demo should never accumulate one visitor's edits into the next visitor's session.
function isDemoMode() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')
}

let demo = null
function demoStore() {
  if (!demo) {
    demo = {
      contacts: DEMO_CONTACTS.map(c => ({ ...c })),
      applications: DEMO_APPLICATIONS.map(a => ({ ...a })),
      interactions: DEMO_INTERACTIONS.map(i => ({ ...i })),
      calls: DEMO_CALLS.map(c => ({ ...c })),
      contactRelationships: DEMO_CONTACT_RELATIONSHIPS.map(r => ({ ...r })),
      schools: DEMO_SCHOOLS.map(s => ({ ...s })),
      employers: DEMO_EMPLOYERS.map(e => ({ ...e })),
      events: DEMO_EVENTS.map(e => ({ ...e, requirements: e.requirements.map(r => ({ ...r })) })),
      userEvents: DEMO_USER_EVENTS.map(u => ({ ...u })),
      eventRelevance: DEMO_EVENT_RELEVANCE.map(r => ({ ...r })),
      requirementCompletions: DEMO_REQUIREMENT_COMPLETIONS.map(c => ({ ...c })),
      ingestSources: DEMO_INGEST_SOURCES.map(i => ({ ...i })),
    }
  }
  return demo
}

// ── Contacts ────────────────────────────────────────────────────────────────

function mapContactRow(r) {
  return {
    id: r.id,
    name: r.name,
    company: r.company || '',
    role: r.role || '',
    email: r.email || '',
    linkedin: r.linkedin || null,
    source: r.source || '',
    status: r.status || '🟡 Cooling',
    urgency: r.urgency || 'LOW',
    lastInteraction: r.last_interaction,
    followUpDate: r.follow_up_date,
    notes: r.notes || '',
    whatTheyDid: r.what_they_did || '',
    referredById: r.referred_by_id || null,
    followUpDraft: r.follow_up_draft || '',
    followUpDraftTier: r.follow_up_draft_tier,
    followUpDraftKind: r.follow_up_draft_kind || '',
    isUMichAlum: !!r.is_school_alum,
    affinity: r.affinity || [],
    lifeDomain: r.life_domain || [],
    wantsToSchedule: !!r.wants_to_schedule,
    scheduleBy: r.schedule_by,
    scheduleNote: r.schedule_note || '',
    referralStatus: r.referral_status || 'Not Asked',
  }
}

export async function searchContactByName(name) {
  if (isDemoMode()) {
    const firstWord = name.split(' ')[0].toLowerCase()
    const match = demoStore().contacts.find(c => c.name.toLowerCase().includes(firstWord))
    return match ? { id: match.id, name: match.name } : null
  }
  const firstWord = name.split(' ')[0]
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name')
    .eq('archived', false)
    .ilike('name', `%${firstWord}%`)
    .limit(5)
  if (error) return null
  return data?.[0] || null
}

export async function addContact({ name, company, role, email }) {
  const roleSelect = ROLE_OPTIONS.find(r => role?.toLowerCase().includes(r.toLowerCase())) || 'Other'
  if (isDemoMode()) {
    const id = nextDemoId()
    demoStore().contacts.push({
      id, name, company: company || '', role: roleSelect, email: email || '', linkedin: null, source: '',
      status: '🟡 Cooling', urgency: 'LOW', lastInteraction: todayStr(), followUpDate: plusDays(3), notes: '',
      whatTheyDid: '', referredById: null, followUpDraft: '', followUpDraftTier: null, followUpDraftKind: '',
      isUMichAlum: false, affinity: [], lifeDomain: [], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
      referralStatus: 'Not Asked', referredByName: null,
    })
    return { id }
  }
  const { data, error } = await supabase.from('contacts').insert({
    name,
    company: company || null,
    role: roleSelect,
    email: email || null,
    status: '🟡 Cooling',
    last_interaction: todayStr(),
    follow_up_date: plusDays(3),
  }).select('id').single()
  throwIfError(error, 'addContact')
  return data
}

const CONTACT_FIELD_MAP = {
  name: 'name',
  company: 'company',
  email: 'email',
  linkedin: 'linkedin',
  notes: 'notes',
  whatTheyDid: 'what_they_did',
  followUpDraft: 'follow_up_draft',
  scheduleNote: 'schedule_note',
}

const CONTACT_DEMO_KEYS = [
  'name', 'company', 'role', 'email', 'linkedin', 'notes', 'whatTheyDid', 'followUpDraft', 'scheduleNote',
  'source', 'status', 'urgency', 'lastInteraction', 'followUpDate', 'referredById', 'followUpDraftTier',
  'followUpDraftKind', 'isUMichAlum', 'affinity', 'lifeDomain', 'exaEnriched', 'wantsToSchedule', 'scheduleBy', 'referralStatus',
]

export async function updateContact(id, fields) {
  if (isDemoMode()) {
    const { contacts } = demoStore()
    const c = contacts.find(c => c.id === id)
    if (!c) return
    for (const k of CONTACT_DEMO_KEYS) if (k in fields) c[k] = fields[k]
    if ('referredById' in fields) {
      const ref = contacts.find(x => x.id === fields.referredById)
      c.referredByName = ref ? ref.name : null
    }
    return
  }
  const patch = {}
  for (const [jsKey, col] of Object.entries(CONTACT_FIELD_MAP)) {
    if (jsKey in fields) patch[col] = fields[jsKey] || ''
  }
  if ('role' in fields) patch.role = fields.role || null
  if ('source' in fields) patch.source = fields.source || null
  if ('status' in fields) patch.status = fields.status || null
  if ('urgency' in fields) patch.urgency = fields.urgency || null
  if ('lastInteraction' in fields) patch.last_interaction = fields.lastInteraction || null
  if ('followUpDate' in fields) patch.follow_up_date = fields.followUpDate || null
  if ('referredById' in fields) patch.referred_by_id = fields.referredById || null
  if ('followUpDraftTier' in fields) patch.follow_up_draft_tier = fields.followUpDraftTier ?? null
  if ('followUpDraftKind' in fields) patch.follow_up_draft_kind = fields.followUpDraftKind || null
  if ('isUMichAlum' in fields) patch.is_school_alum = !!fields.isUMichAlum
  if ('affinity' in fields) patch.affinity = fields.affinity || []
  if ('lifeDomain' in fields) patch.life_domain = fields.lifeDomain || []
  if ('exaEnriched' in fields) patch.exa_enriched = !!fields.exaEnriched
  if ('wantsToSchedule' in fields) patch.wants_to_schedule = !!fields.wantsToSchedule
  if ('scheduleBy' in fields) patch.schedule_by = fields.scheduleBy || null
  if ('referralStatus' in fields) patch.referral_status = fields.referralStatus || null

  const { error } = await supabase.from('contacts').update(patch).eq('id', id)
  throwIfError(error, 'updateContact')
}

export async function fetchContacts() {
  if (isDemoMode()) return demoStore().contacts.map(c => ({ ...c }))
  const { data, error } = await supabase.from('contacts').select('*').eq('archived', false)
  throwIfError(error, 'fetchContacts')
  const contacts = (data || []).map(mapContactRow)
  const byId = Object.fromEntries(contacts.map(c => [c.id, c]))
  return contacts.map(c => ({ ...c, referredByName: c.referredById ? (byId[c.referredById]?.name || null) : null }))
}

export async function archiveContact(id) {
  if (isDemoMode()) {
    const { contacts } = demoStore()
    const i = contacts.findIndex(c => c.id === id)
    if (i !== -1) contacts.splice(i, 1)
    return
  }
  const { error } = await supabase.from('contacts').update({ archived: true }).eq('id', id)
  throwIfError(error, 'archiveContact')
}

// ── Calls ───────────────────────────────────────────────────────────────────

export async function addCallEntry({ contactId, contactName, company, summary, keyInsights, commitments, followUpDraft }) {
  const title = `${contactName} @ ${company || '?'} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  if (isDemoMode()) {
    const id = nextDemoId()
    demoStore().calls.push({ id, title, contactId: contactId || null, date: todayStr(), summary: summary || '', keyInsights: keyInsights || '', fullTranscript: '' })
    return { id }
  }
  const { data, error } = await supabase.from('calls').insert({
    title,
    date: todayStr(),
    contact_id: contactId || null,
    summary: summary || null,
    key_insights: keyInsights || null,
    my_commitments: commitments || null,
    follow_up_draft: followUpDraft || null,
  }).select('id').single()
  throwIfError(error, 'addCallEntry')
  return data
}

export async function fetchCalls() {
  if (isDemoMode()) return demoStore().calls.map(c => ({ ...c }))
  const { data, error } = await supabase.from('calls').select('*')
  throwIfError(error, 'fetchCalls')
  return (data || []).map(r => ({
    id: r.id,
    title: r.title || '',
    contactId: r.contact_id || null,
    date: r.date,
    summary: r.summary || '',
    keyInsights: r.key_insights || '',
    fullTranscript: r.full_transcript || '',
  }))
}

// ── Applications ─────────────────────────────────────────────────────────────

export async function addApplication({ company, role, jdLink, location, sourceRepo, datePosted, referredById }) {
  if (isDemoMode()) {
    const id = nextDemoId()
    demoStore().applications.push({
      id, company, role: role || '', stage: 'Wishlist', triage: 'Needs Review', location: location || '',
      sourceRepo: sourceRepo || '', appliedDate: null, closedDate: null, lastActivity: todayStr(), daysInStage: null,
      jdLink: jdLink || '', notes: datePosted ? `Posted ${datePosted}` : '', createdTime: todayStr(),
      referredById: referredById || null,
    })
    return { id }
  }
  const { data, error } = await supabase.from('applications').insert({
    company,
    role: role || null,
    jd_link: jdLink || null,
    location: location || null,
    source_repo: sourceRepo || null,
    notes: datePosted ? `Posted ${datePosted}` : null,
    stage: 'Wishlist',
    triage: 'Needs Review',
    referred_by_id: referredById || null,
  }).select('id').single()
  throwIfError(error, 'addApplication')
  return data
}

export async function updateApplicationTriage(id, triage, currentStage) {
  if (isDemoMode()) {
    const a = demoStore().applications.find(a => a.id === id)
    if (!a) return
    a.triage = triage
    if (triage === 'Applied' && (!currentStage || currentStage === 'Wishlist')) {
      a.stage = 'Applied'
      a.appliedDate = todayStr()
    }
    return
  }
  const patch = { triage }
  if (triage === 'Applied' && (!currentStage || currentStage === 'Wishlist')) {
    patch.stage = 'Applied'
    patch.applied_date = todayStr()
  }
  const { error } = await supabase.from('applications').update(patch).eq('id', id)
  throwIfError(error, 'updateApplicationTriage')
}

export async function updateApplication(id, fields) {
  if (isDemoMode()) {
    const a = demoStore().applications.find(a => a.id === id)
    if (!a) return
    for (const k of ['company', 'role', 'location', 'jdLink', 'notes', 'stage', 'appliedDate', 'closedDate', 'referredById', 'oaDueDate', 'oaLink', 'oaCompleted', 'oaResearchCheckedAt']) {
      if (k in fields) a[k] = fields[k]
    }
    return
  }
  const patch = {}
  if ('company' in fields) patch.company = fields.company || ''
  if ('role' in fields) patch.role = fields.role || ''
  if ('location' in fields) patch.location = fields.location || ''
  if ('jdLink' in fields) patch.jd_link = fields.jdLink || null
  if ('notes' in fields) patch.notes = fields.notes || ''
  if ('stage' in fields) patch.stage = fields.stage || null
  if ('appliedDate' in fields) patch.applied_date = fields.appliedDate || null
  if ('closedDate' in fields) patch.closed_date = fields.closedDate || null
  if ('referredById' in fields) patch.referred_by_id = fields.referredById || null
  if ('oaDueDate' in fields) patch.oa_due_date = fields.oaDueDate || null
  if ('oaLink' in fields) patch.oa_link = fields.oaLink || null
  if ('oaCompleted' in fields) patch.oa_completed = !!fields.oaCompleted
  if ('oaResearchCheckedAt' in fields) patch.oa_research_checked_at = fields.oaResearchCheckedAt || null
  const { error } = await supabase.from('applications').update(patch).eq('id', id)
  throwIfError(error, 'updateApplication')
}

export async function fetchApplications() {
  if (isDemoMode()) return demoStore().applications.map(a => ({ ...a }))
  // PostgREST caps a single response at 1000 rows — this table's Job Boards auto-import
  // volume has grown past that, which was silently dropping newest rows (no .order() meant
  // an arbitrary 1000 came back). Page through with .range() so nothing gets dropped.
  const PAGE_SIZE = 1000
  const data = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error } = await supabase.from('applications').select('*').eq('archived', false)
      .order('created_at', { ascending: true }).range(from, from + PAGE_SIZE - 1)
    throwIfError(error, 'fetchApplications')
    data.push(...(page || []))
    if (!page || page.length < PAGE_SIZE) break
  }
  const now = new Date()
  return (data || []).map(r => ({
    id: r.id,
    company: r.company || '',
    role: r.role || '',
    stage: r.stage || 'Applied',
    triage: r.triage || 'Needs Review',
    location: r.location || '',
    sourceRepo: r.source_repo || '',
    appliedDate: r.applied_date,
    closedDate: r.closed_date,
    lastActivity: r.last_activity,
    daysInStage: r.applied_date ? daysBetween(now, new Date(r.applied_date)) : null,
    jdLink: r.jd_link,
    notes: r.notes || '',
    createdTime: r.created_at,
    referredById: r.referred_by_id || null,
    oaDueDate: r.oa_due_date || null,
    oaLink: r.oa_link || null,
    oaCompleted: !!r.oa_completed,
    oaResearchCheckedAt: r.oa_research_checked_at || null,
  }))
}

export async function archiveApplication(id) {
  if (isDemoMode()) {
    const { applications } = demoStore()
    const i = applications.findIndex(a => a.id === id)
    if (i !== -1) applications.splice(i, 1)
    return
  }
  const { error } = await supabase.from('applications').update({ archived: true }).eq('id', id)
  throwIfError(error, 'archiveApplication')
}

// ── Interactions ─────────────────────────────────────────────────────────────

export async function addInteraction({ contactId, contactName, type, direction, date: interactionDate, channelRef, summary, body }) {
  const date = interactionDate || todayStr()
  const title = `${type} — ${contactName || '?'} — ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  if (isDemoMode()) {
    const id = nextDemoId()
    demoStore().interactions.push({ id, contactId: contactId || null, type: type || '', direction: direction || '', date, channelRef: channelRef || '', summary: summary || '', body: body ? body.slice(0, 2000) : '' })
    return { id, title }
  }
  const { data, error } = await supabase.from('interactions').insert({
    contact_id: contactId || null,
    type: type || null,
    direction: direction || null,
    date,
    channel_ref: channelRef || null,
    summary: summary || null,
    body: body ? body.slice(0, 2000) : null,
  }).select('id').single()
  throwIfError(error, 'addInteraction')
  return { id: data.id, title }
}

export async function fetchInteractions() {
  if (isDemoMode()) {
    return demoStore().interactions.map(i => ({ ...i })).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }
  const { data, error } = await supabase.from('interactions').select('*')
  throwIfError(error, 'fetchInteractions')
  return (data || [])
    .map(r => ({
      id: r.id,
      contactId: r.contact_id || null,
      type: r.type || '',
      direction: r.direction || '',
      date: r.date,
      channelRef: r.channel_ref || '',
      summary: r.summary || '',
      body: r.body || '',
    }))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
}

// ── Contact Relationships ───────────────────────────────────────────────────
// Typed, directed edges between two contacts (Mentor Of, College Friend Of, etc.) —
// additive alongside contacts.referred_by_id, not a replacement for it. Mirrors
// interactions' insert/list shape, plus a delete since a relationship is a mutable
// fact the user can mis-tag and remove, not an append-only log entry.

export async function fetchContactRelationships() {
  if (isDemoMode()) return demoStore().contactRelationships.map(r => ({ ...r }))
  const { data, error } = await supabase.from('contact_relationships').select('*')
  throwIfError(error, 'fetchContactRelationships')
  return (data || []).map(r => ({
    id: r.id,
    fromContactId: r.from_contact_id,
    toContactId: r.to_contact_id,
    relationshipType: r.relationship_type,
    note: r.note || '',
  }))
}

export async function addContactRelationship({ fromContactId, toContactId, relationshipType, note }) {
  if (isDemoMode()) {
    const id = nextDemoId()
    demoStore().contactRelationships.push({ id, fromContactId, toContactId, relationshipType, note: note || '' })
    return { id }
  }
  const { data, error } = await supabase.from('contact_relationships').insert({
    from_contact_id: fromContactId,
    to_contact_id: toContactId,
    relationship_type: relationshipType,
    note: note || null,
  }).select('id').single()
  throwIfError(error, 'addContactRelationship')
  return data
}

export async function deleteContactRelationship(id) {
  if (isDemoMode()) {
    const { contactRelationships } = demoStore()
    const idx = contactRelationships.findIndex(r => r.id === id)
    if (idx !== -1) contactRelationships.splice(idx, 1)
    return
  }
  const { error } = await supabase.from('contact_relationships').delete().eq('id', id)
  throwIfError(error, 'deleteContactRelationship')
}

// ── Target companies (Explore/Discover/Coverage's shared target-company list) ──
// Was rec_target_companies in localStorage — the single piece of state all three
// features depend on, and therefore the highest-leverage one to get off a single-browser
// cache. Stored in user_settings (generic per-user KV, already RLS'd, see
// supabase/migrations/20260723000000_init.sql) under key='target_companies', so the list
// now syncs across devices instead of resetting every time the user opens a new browser.
// Demo mode never calls this (Explore/Discover/Coverage aren't in the demo nav), but the
// branch is here for consistency with every other export in this file.

export async function fetchTargetCompanies() {
  if (isDemoMode()) return []
  const { data, error } = await supabase.from('user_settings').select('value').eq('key', 'target_companies').maybeSingle()
  throwIfError(error, 'fetchTargetCompanies')
  return data?.value || []
}

export async function saveTargetCompanies(companies) {
  if (isDemoMode()) return
  const { error } = await supabase.from('user_settings')
    .upsert({ key: 'target_companies', value: companies }, { onConflict: 'user_id,key' })
  throwIfError(error, 'saveTargetCompanies')
}

// ── Recruiting Events ───────────────────────────────────────────────────────
// The shared, school-scoped pool (schools / employers / events + attributes +
// requirements / ingest_sources) is READ-ONLY from the client — Postgres has no
// insert/update/delete policies on those tables, only service-role handlers in
// api/ write them (see supabase/migrations/20260913000000_recruiting_events.sql's
// TENANCY NOTE). The per-user overlays (user_events, user_event_relevance,
// user_event_requirement_completions) are ordinary `auth.uid() = user_id` tables
// and are written directly here like everything else in this file.

function mapSchoolRow(r) {
  return {
    id: r.id, slug: r.slug, name: r.name, emailDomain: r.email_domain || null, timezone: r.timezone,
    feedConfig: r.feed_config || {}, termWindows: r.term_windows || [], transitBufferMin: r.transit_buffer_min ?? 15,
  }
}

function mapEmployerRow(r) {
  return { id: r.id, name: r.name, normalizedName: r.normalized_name, website: r.website || null }
}

function mapRequirementRow(r) {
  return {
    id: r.id, eventId: r.event_id, stepOrder: r.step_order, kind: r.kind, label: r.label || '',
    url: r.url || null, dueAt: r.due_at || null, required: r.required !== false,
  }
}

function mapAttributesRow(a) {
  if (!a) return null
  return {
    roles: a.roles || [], majors: a.majors || [], term: a.term || null, format: a.format || null,
    sponsorship: a.sponsorship || null, employerIds: a.employer_ids || [], extractedAt: a.extracted_at || null,
    contentHash: a.content_hash || null, deadlineCheckedAt: a.raw?.deadlineCheckedAt || null, deadlineNote: a.raw?.deadlineNote || null,
  }
}

function mapEventRow(r) {
  // PostgREST embeds a 1:1 as an object and a 1:many as an array.
  const attrs = Array.isArray(r.event_attributes) ? r.event_attributes[0] : r.event_attributes
  return {
    id: r.id, schoolId: r.school_id, visibility: r.visibility, contributedBy: r.contributed_by || null,
    kind: r.kind, title: r.title, description: r.description || '', location: r.location || '',
    isVirtual: !!r.is_virtual, startsAt: r.starts_at, endsAt: r.ends_at || null, allDay: !!r.all_day,
    timezone: r.timezone || null, url: r.url || null, registrationUrl: r.registration_url || null,
    registrationDeadline: r.registration_deadline || null, employerId: r.employer_id || null,
    sourceKind: r.source_kind, sourceRef: r.source_ref || null, sourceLastVerifiedAt: r.source_last_verified_at,
    confidence: r.confidence == null ? 1 : Number(r.confidence), archived: !!r.archived,
    attributes: mapAttributesRow(attrs),
    requirements: (r.event_requirements || []).map(mapRequirementRow).sort((a, b) => a.stepOrder - b.stepOrder),
  }
}

function mapUserEventRow(r) {
  return {
    userId: r.user_id, eventId: r.event_id, status: r.status, calendarSlot: r.calendar_slot || null,
    calendarEventId: r.calendar_event_id || null, calendarSyncedAt: r.calendar_synced_at || null,
    notes: r.notes || '', followupDueAt: r.followup_due_at || null, followupDoneAt: r.followup_done_at || null,
    blockOverrides: r.block_overrides || {},
  }
}

function mapRelevanceRow(r) {
  return {
    userId: r.user_id, eventId: r.event_id, score: r.score == null ? null : Number(r.score), tier: r.tier || null,
    reason: r.reason || '', overrideTier: r.override_tier || null, dismissedAt: r.dismissed_at || null,
    inputHash: r.input_hash || null, computedAt: r.computed_at || null,
  }
}

function mapIngestSourceRow(r) {
  return {
    id: r.id, schoolId: r.school_id, kind: r.kind, ref: r.ref, label: r.label || '', lastRunAt: r.last_run_at || null,
    lastSuccessAt: r.last_success_at || null, lastCount: r.last_count ?? null, degradedAt: r.degraded_at || null,
    degradedReason: r.degraded_reason || null,
  }
}

export async function fetchSchools() {
  if (isDemoMode()) return demoStore().schools.map(s => ({ ...s }))
  const { data, error } = await supabase.from('schools').select('*').order('name')
  throwIfError(error, 'fetchSchools')
  return (data || []).map(mapSchoolRow)
}

export async function fetchEmployers() {
  if (isDemoMode()) return demoStore().employers.map(e => ({ ...e }))
  const { data, error } = await supabase.from('employers').select('*').order('name')
  throwIfError(error, 'fetchEmployers')
  return (data || []).map(mapEmployerRow)
}

// Every event the signed-in user can read (RLS: their school's shared pool +
// their own private rows), with attributes + requirements embedded. `from`/`to`
// are ISO strings bounding starts_at; default is 7 days back → 120 days ahead.
export async function fetchSchoolEvents({ from, to } = {}) {
  const fromIso = from || new Date(Date.now() - 7 * 86400000).toISOString()
  const toIso = to || new Date(Date.now() + 120 * 86400000).toISOString()
  if (isDemoMode()) {
    return demoStore().events
      .filter(e => !e.archived && e.startsAt >= fromIso && e.startsAt <= toIso)
      .map(e => ({ ...e, requirements: e.requirements.map(r => ({ ...r })) }))
  }
  const { data, error } = await supabase
    .from('events')
    .select('*, event_attributes(*), event_requirements(*)')
    .eq('archived', false)
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso)
    .order('starts_at', { ascending: true })
  throwIfError(error, 'fetchSchoolEvents')
  return (data || []).map(mapEventRow)
}

export async function fetchIngestSources() {
  if (isDemoMode()) return demoStore().ingestSources.map(s => ({ ...s }))
  const { data, error } = await supabase.from('ingest_sources').select('*').order('label')
  throwIfError(error, 'fetchIngestSources')
  return (data || []).map(mapIngestSourceRow)
}

// The signed-in user's private overlay across all three per-user tables in one
// round trip — status/notes, relevance, and requirement completions.
export async function fetchMyEventState() {
  if (isDemoMode()) {
    const d = demoStore()
    return {
      userEvents: d.userEvents.map(u => ({ ...u })),
      relevance: d.eventRelevance.map(r => ({ ...r })),
      completions: d.requirementCompletions.map(c => ({ ...c })),
    }
  }
  const [ue, rel, comp] = await Promise.all([
    supabase.from('user_events').select('*'),
    supabase.from('user_event_relevance').select('*'),
    supabase.from('user_event_requirement_completions').select('*'),
  ])
  throwIfError(ue.error, 'fetchMyEventState.user_events')
  throwIfError(rel.error, 'fetchMyEventState.relevance')
  throwIfError(comp.error, 'fetchMyEventState.completions')
  return {
    userEvents: (ue.data || []).map(mapUserEventRow),
    relevance: (rel.data || []).map(mapRelevanceRow),
    completions: (comp.data || []).map(c => ({ userId: c.user_id, requirementId: c.requirement_id, completedAt: c.completed_at })),
  }
}

const USER_EVENT_FIELD_MAP = {
  status: 'status', calendarSlot: 'calendar_slot', calendarEventId: 'calendar_event_id',
  calendarSyncedAt: 'calendar_synced_at', notes: 'notes', followupDueAt: 'followup_due_at',
  followupDoneAt: 'followup_done_at', blockOverrides: 'block_overrides',
}

// NOTE: callers must gate status='confirmed'/'attended' through
// lib/eventRequirements.js's canSetStatus() first — this writer doesn't re-check.
export async function upsertUserEvent(eventId, fields = {}) {
  if (isDemoMode()) {
    const { userEvents } = demoStore()
    let row = userEvents.find(u => u.eventId === eventId)
    if (!row) {
      row = { userId: 'demo-user', eventId, status: 'interested', calendarSlot: null, calendarEventId: null, calendarSyncedAt: null, notes: '', followupDueAt: null, followupDoneAt: null, blockOverrides: {} }
      userEvents.push(row)
    }
    Object.assign(row, fields)
    return { ...row }
  }
  const patch = { event_id: eventId }
  for (const [camel, snake] of Object.entries(USER_EVENT_FIELD_MAP)) if (camel in fields) patch[snake] = fields[camel]
  const { data, error } = await supabase.from('user_events')
    .upsert(patch, { onConflict: 'user_id,event_id' }).select('*').single()
  throwIfError(error, 'upsertUserEvent')
  return mapUserEventRow(data)
}

export async function removeUserEvent(eventId) {
  if (isDemoMode()) {
    const { userEvents } = demoStore()
    const idx = userEvents.findIndex(u => u.eventId === eventId)
    if (idx !== -1) userEvents.splice(idx, 1)
    return
  }
  const { error } = await supabase.from('user_events').delete().eq('event_id', eventId)
  throwIfError(error, 'removeUserEvent')
}

const RELEVANCE_FIELD_MAP = {
  score: 'score', tier: 'tier', reason: 'reason', overrideTier: 'override_tier',
  dismissedAt: 'dismissed_at', inputHash: 'input_hash', computedAt: 'computed_at',
}

export async function upsertEventRelevance(eventId, fields = {}) {
  if (isDemoMode()) {
    const { eventRelevance } = demoStore()
    let row = eventRelevance.find(r => r.eventId === eventId)
    if (!row) {
      row = { userId: 'demo-user', eventId, score: null, tier: null, reason: '', overrideTier: null, dismissedAt: null, inputHash: null, computedAt: null }
      eventRelevance.push(row)
    }
    Object.assign(row, fields)
    return { ...row }
  }
  const patch = { event_id: eventId }
  for (const [camel, snake] of Object.entries(RELEVANCE_FIELD_MAP)) if (camel in fields) patch[snake] = fields[camel]
  const { data, error } = await supabase.from('user_event_relevance')
    .upsert(patch, { onConflict: 'user_id,event_id' }).select('*').single()
  throwIfError(error, 'upsertEventRelevance')
  return mapRelevanceRow(data)
}

// Bulk variant for the scorer — one round trip per recompute, not one per event.
export async function upsertEventRelevanceMany(rows) {
  if (!rows?.length) return
  if (isDemoMode()) {
    for (const r of rows) await upsertEventRelevance(r.eventId, r)
    return
  }
  const patches = rows.map(r => {
    const patch = { event_id: r.eventId }
    for (const [camel, snake] of Object.entries(RELEVANCE_FIELD_MAP)) if (camel in r) patch[snake] = r[camel]
    return patch
  })
  const { error } = await supabase.from('user_event_relevance').upsert(patches, { onConflict: 'user_id,event_id' })
  throwIfError(error, 'upsertEventRelevanceMany')
}

export async function setRequirementCompletion(requirementId, completed) {
  if (isDemoMode()) {
    const { requirementCompletions } = demoStore()
    const idx = requirementCompletions.findIndex(c => c.requirementId === requirementId)
    if (completed && idx === -1) requirementCompletions.push({ userId: 'demo-user', requirementId, completedAt: new Date().toISOString() })
    if (!completed && idx !== -1) requirementCompletions.splice(idx, 1)
    return
  }
  if (completed) {
    const { error } = await supabase.from('user_event_requirement_completions')
      .upsert({ requirement_id: requirementId, completed_at: new Date().toISOString() }, { onConflict: 'user_id,requirement_id' })
    throwIfError(error, 'setRequirementCompletion')
  } else {
    const { error } = await supabase.from('user_event_requirement_completions').delete().eq('requirement_id', requirementId)
    throwIfError(error, 'setRequirementCompletion')
  }
}
