// Cross-school + cross-user read isolation on the shared-pool tables.
//
// This is the highest-consequence test in the Recruiting Events milestone: it
// proves, through the anon-key client with real JWTs (NOT the service role),
// that Postgres itself enforces the tenancy split described at the top of
// supabase/migrations/20260913000000_recruiting_events.sql.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_ANON_KEY in the
// root .env and the migration applied to that project. Skips (loudly) otherwise.
// Creates 3 throwaway users + 2 throwaway schools and deletes all of it after.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const configured = !!(url && serviceKey && anonKey)

const clientOpts = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws } }
const admin = configured ? createClient(url, serviceKey, clientOpts) : null

const run = Date.now().toString(36)
const PW = `rls-test-${run}-Aa1!`
const users = {}      // A, B (school 1), C (school 2)
const clients = {}
const schools = {}    // s1, s2
const events = {}     // shared1, shared2, privateA
let requirementId = null

async function makeUser(tag) {
  const email = `rls-${tag}-${run}@test.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true })
  if (error) throw error
  const client = createClient(url, anonKey, clientOpts)
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
  if (signInErr) throw signInErr
  users[tag] = data.user
  clients[tag] = client
}

async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

describe.skipIf(!configured)('shared-pool RLS isolation', () => {
  beforeAll(async () => {
    for (const s of ['s1', 's2']) {
      schools[s] = await must(admin.from('schools').insert({
        slug: `rls-${s}-${run}`, name: `RLS Test School ${s} ${run}`,
      }).select('id').single(), `create ${s}`)
    }
    await Promise.all(['A', 'B', 'C'].map(makeUser))
    // Profiles are auto-created by the signup trigger; assign schools.
    await must(admin.from('profiles').update({ school_id: schools.s1.id }).in('id', [users.A.id, users.B.id]), 'profiles s1')
    await must(admin.from('profiles').update({ school_id: schools.s2.id }).eq('id', users.C.id), 'profiles s2')

    const base = { kind: 'career_fair', starts_at: '2026-10-01T14:00:00Z', ends_at: '2026-10-01T20:00:00Z', source_kind: 'manual' }
    events.shared1 = await must(admin.from('events').insert({
      ...base, school_id: schools.s1.id, title: `S1 shared fair ${run}`, dedup_key: `s1-shared-${run}`,
    }).select('id').single(), 'shared1')
    events.shared2 = await must(admin.from('events').insert({
      ...base, school_id: schools.s2.id, title: `S2 shared fair ${run}`, dedup_key: `s2-shared-${run}`,
    }).select('id').single(), 'shared2')
    events.privateA = await must(admin.from('events').insert({
      ...base, school_id: schools.s1.id, title: `A private coffee chat ${run}`, dedup_key: `s1-private-a-${run}`,
      visibility: 'private', contributed_by: users.A.id, kind: 'coffee_chat',
    }).select('id').single(), 'privateA')

    await must(admin.from('event_attributes').insert({ event_id: events.shared1.id, roles: ['SWE'] }), 'attrs')
    const req = await must(admin.from('event_requirements').insert({
      event_id: events.shared1.id, step_order: 1, kind: 'register', due_at: '2026-09-24T00:00:00Z',
    }).select('id').single(), 'requirement')
    requirementId = req.id
    await must(admin.from('ingest_sources').insert({ school_id: schools.s1.id, kind: 'localist', ref: `3172-${run}` }), 'source')

    // B's private overlay rows, written as B through RLS (so the with-check side is exercised too).
    await must(clients.B.from('user_events').insert({ event_id: events.shared1.id, status: 'registering', notes: 'B secret notes' }), 'B user_events')
    await must(clients.B.from('user_event_relevance').insert({ event_id: events.shared1.id, score: 9.5, tier: 'high', reason: 'B reason' }), 'B relevance')
    await must(clients.B.from('user_event_requirement_completions').insert({ requirement_id: requirementId }), 'B completion')
  })

  afterAll(async () => {
    if (!admin) return
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id).catch(() => {})
    await admin.from('schools').delete().in('id', Object.values(schools).map(s => s.id))  // cascades events/attrs/reqs/sources
  })

  it('a user reads their own school\'s shared events and nothing from another school', async () => {
    const a = await must(clients.A.from('events').select('id, title').order('title'), 'A events')
    const ids = a.map(e => e.id)
    expect(ids).toContain(events.shared1.id)
    expect(ids).toContain(events.privateA.id)
    expect(ids).not.toContain(events.shared2.id)

    const c = await must(clients.C.from('events').select('id'), 'C events')
    expect(c.map(e => e.id)).toEqual([events.shared2.id])
  })

  it('a private manual event is invisible to a same-school peer', async () => {
    const b = await must(clients.B.from('events').select('id'), 'B events')
    expect(b.map(e => e.id)).toContain(events.shared1.id)
    expect(b.map(e => e.id)).not.toContain(events.privateA.id)
  })

  it('event_attributes / event_requirements / ingest_sources follow the event\'s school', async () => {
    expect((await must(clients.A.from('event_attributes').select('event_id'), 'A attrs')).length).toBe(1)
    expect((await must(clients.C.from('event_attributes').select('event_id'), 'C attrs')).length).toBe(0)
    expect((await must(clients.A.from('event_requirements').select('id'), 'A reqs')).map(r => r.id)).toEqual([requirementId])
    expect((await must(clients.C.from('event_requirements').select('id'), 'C reqs')).length).toBe(0)
    expect((await must(clients.A.from('ingest_sources').select('id'), 'A sources')).length).toBe(1)
    expect((await must(clients.C.from('ingest_sources').select('id'), 'C sources')).length).toBe(0)
  })

  it('a user with no school sees no shared events at all', async () => {
    await must(admin.from('profiles').update({ school_id: null }).eq('id', users.C.id), 'C unassign')
    expect((await must(clients.C.from('events').select('id'), 'C none')).length).toBe(0)
    await must(admin.from('profiles').update({ school_id: schools.s2.id }).eq('id', users.C.id), 'C reassign')
  })

  it('no client can write to the shared pool (insert / update / delete are all denied)', async () => {
    const { error: insErr } = await clients.A.from('events').insert({
      school_id: schools.s1.id, title: 'poison', starts_at: '2026-10-02T00:00:00Z', source_kind: 'manual', dedup_key: `poison-${run}`,
    })
    expect(insErr?.code).toBe('42501')
    // Update/delete on a row A CAN read: RLS silently affects 0 rows.
    await must(clients.A.from('events').update({ title: 'renamed' }).eq('id', events.shared1.id), 'A update')
    await must(clients.A.from('events').delete().eq('id', events.shared1.id), 'A delete')
    const still = await must(admin.from('events').select('title').eq('id', events.shared1.id).single(), 'verify')
    expect(still.title).toBe(`S1 shared fair ${run}`)
    // Valid rows (so the failure is RLS, not a NOT NULL constraint firing first).
    const attempts = {
      schools: { slug: `poison-${run}`, name: 'Poison U' },
      employers: { name: 'Poison Co', normalized_name: `poison co ${run}` },
      event_attributes: { event_id: events.shared1.id, roles: ['PM'] },
      event_requirements: { event_id: events.shared1.id, step_order: 99, kind: 'register' },
      ingest_sources: { school_id: schools.s1.id, kind: 'localist', ref: `poison-${run}` },
    }
    for (const [table, row] of Object.entries(attempts)) {
      const { error } = await clients.A.from(table).insert(row).select()
      expect(error, `${table} insert should be denied`).toBeTruthy()
      expect(error?.code, `${table} should fail on RLS (42501), not a constraint`).toBe('42501')
    }
  })

  it('one user\'s status, notes, relevance and completions are invisible to every other user', async () => {
    for (const tag of ['A', 'C']) {
      expect((await must(clients[tag].from('user_events').select('*'), `${tag} user_events`)).length).toBe(0)
      expect((await must(clients[tag].from('user_event_relevance').select('*'), `${tag} relevance`)).length).toBe(0)
      expect((await must(clients[tag].from('user_event_requirement_completions').select('*'), `${tag} completions`)).length).toBe(0)
    }
    const b = await must(clients.B.from('user_events').select('notes'), 'B own')
    expect(b).toEqual([{ notes: 'B secret notes' }])
  })

  it('a user cannot write overlay rows on behalf of another user', async () => {
    const { error } = await clients.A.from('user_events').insert({ user_id: users.B.id, event_id: events.shared1.id, status: 'skipped' })
    expect(error).toBeTruthy()
    const { error: relErr } = await clients.A.from('user_event_relevance').upsert({ user_id: users.B.id, event_id: events.shared1.id, dismissed_at: new Date().toISOString() })
    expect(relErr).toBeTruthy()
    const bRow = await must(admin.from('user_events').select('status').eq('user_id', users.B.id).single(), 'B intact')
    expect(bRow.status).toBe('registering')
  })

  it('aggregates leak nothing: counting user_events over a shared event returns only the caller\'s rows', async () => {
    const { count } = await clients.A.from('user_events').select('*', { count: 'exact', head: true }).eq('event_id', events.shared1.id)
    expect(count).toBe(0)
    const { count: bCount } = await clients.B.from('user_events').select('*', { count: 'exact', head: true }).eq('event_id', events.shared1.id)
    expect(bCount).toBe(1)
  })
})

if (!configured) {
  describe('shared-pool RLS isolation', () => {
    it.skip('SKIPPED — set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY in the root .env', () => {})
  })
}
