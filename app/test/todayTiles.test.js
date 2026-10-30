import { describe, it, expect } from 'vitest'
import { pickNextDeadline, funnelConversions, weeklyTrend, pipelineRates, offerDecisions, upcomingInterviews } from '../src/lib/attention.js'

const now = new Date(2026, 9, 9, 12).getTime()

describe('pickNextDeadline', () => {
  it('picks an open OA and labels it', () => {
    const r = pickNextDeadline([{ company: 'Stripe', stage: 'Applied', oaDueDate: '2026-10-12' }], [], now)
    expect(r).toMatchObject({ label: 'Stripe OA', days: 3, kind: 'oa' })
  })
  it('ignores completed, past, and rejected/accepted OAs', () => {
    const apps = [
      { company: 'A', stage: 'Applied', oaDueDate: '2026-10-12', oaCompleted: true },
      { company: 'B', stage: 'Applied', oaDueDate: '2026-10-01' },
      { company: 'C', stage: 'Rejected', oaDueDate: '2026-10-12' },
      { company: 'D', stage: 'Accepted', oaDueDate: '2026-10-12' },
    ]
    expect(pickNextDeadline(apps, [], now)).toBeNull()
  })
  it('takes the soonest across OAs and job deadlines', () => {
    const apps = [{ company: 'Stripe', stage: 'Applied', oaDueDate: '2026-10-14' }]
    expect(pickNextDeadline(apps, [{ company: 'Figma', days: 2 }], now).company).toBe('Figma')
    expect(pickNextDeadline(apps, [{ company: 'Figma', days: 9 }], now).company).toBe('Stripe')
  })
  it('counts an OA due today', () => {
    expect(pickNextDeadline([{ company: 'X', stage: 'Applied', oaDueDate: '2026-10-09' }], [], now).days).toBe(0)
  })
})

describe('funnelConversions', () => {
  const mk = stages => stages.map(stage => ({ stage }))
  it('never exceeds 100% when most apps are past Wishlist', () => {
    const c = funnelConversions(mk(['Wishlist', 'Applied', 'Applied', 'Applied', 'Phone Screen', 'Technical']))
    expect(c.every(x => x.pct <= 100)).toBe(true)
    expect(c[0]).toMatchObject({ from: 'Wishlist', to: 'Applied', pct: 83 })
    expect(c[1]).toMatchObject({ from: 'Applied', to: 'Phone Screen', pct: 40 })
  })
  it('treats Accepted as having reached Offer and skips Rejected', () => {
    const c = funnelConversions(mk(['Applied', 'Accepted', 'Rejected']))
    expect(c.find(x => x.to === 'Offer').pct).toBe(100)
    expect(c[0].pct).toBe(100)
    expect(c.find(x => x.from === 'Applied' && x.to === 'Phone Screen').pct).toBe(50)
  })
  it('omits stages with no one reaching them', () => {
    expect(funnelConversions(mk(['Wishlist']))).toEqual([{ from: 'Wishlist', to: 'Applied', pct: 0 }])
  })
})

// v1.4 spec 05 D: the trend moved out of TodayTab so the stat tile and Network → Flow share it.
describe('weeklyTrend', () => {
  it('buckets interactions into Monday-start weeks, oldest first, empty weeks as 0', () => {
    // now = Fri Oct 9 2026 → current week starts Mon Oct 5.
    const out = weeklyTrend([
      { date: '2026-10-05' }, { date: '2026-10-09' }, // this week
      { date: '2026-09-28' },                         // last week
      { date: '2026-01-01' },                         // outside the window
      { date: null },
    ], now, 3)
    expect(out.map(w => w.count)).toEqual([0, 1, 2])
    expect(out[2].label).toBe('Oct 5')
  })
})

// Today's Rates card: outcomes as a share of applications actually sent, using stage history
// so a rejected app still counts for the stages it reached.
describe('pipelineRates', () => {
  const ev = (...stages) => stages.map((toStage, i) => ({ fromStage: stages[i - 1] || null, toStage, changedAt: `2026-10-0${i + 1}` }))
  const apps = [
    { stage: 'Wishlist' },
    { stage: 'Applied' },
    { stage: 'Applied', oaDueDate: '2026-10-20' },
    { stage: 'Phone Screen', oaCompleted: true },
    { stage: 'Rejected', stageEvents: ev('Applied', 'Technical', 'Rejected') },
    { stage: 'Rejected' },
    { stage: 'Accepted' },
    { stage: 'Applied', triage: 'Pass' },
  ]
  const r = Object.fromEntries(pipelineRates(apps).rates.map(x => [x.key, x]))

  it('uses apps past Wishlist as the base and skips passed ones', () => {
    expect(pipelineRates(apps).applied).toBe(6)
  })
  it('counts OAs from the OA fields', () => {
    expect(r.oa).toMatchObject({ n: 2, pct: 33 })
  })
  it('counts interviews from stage history, including rejected apps and offers', () => {
    expect(r.interview).toMatchObject({ n: 3, pct: 50 })
  })
  it('counts offers (Accepted included) and rejections', () => {
    expect(r.offer).toMatchObject({ n: 1, pct: 17 })
    expect(r.rejected).toMatchObject({ n: 2, pct: 33 })
  })
  it('response is anything heard back: OA, interview, offer or rejection', () => {
    expect(r.response).toMatchObject({ n: 5, pct: 83 })
  })
  it('returns 0% with nothing applied', () => {
    const empty = pipelineRates([{ stage: 'Wishlist' }])
    expect(empty.applied).toBe(0)
    expect(empty.rates.every(x => x.pct === 0)).toBe(true)
  })
})

describe('pickNextDeadline with interviews and offers (v1.4 spec 02)', () => {
  it('counts an offer deadline and an upcoming interview', () => {
    const apps = [
      { company: 'Stripe', stage: 'Applied', oaDueDate: '2026-10-14' },
      { company: 'Ramp', stage: 'Offer', offerDeadline: '2026-10-12' },
      { company: 'Figma', stage: 'Technical', interviewAt: new Date(2026, 9, 11, 14).toISOString() },
    ]
    expect(pickNextDeadline(apps, [], now)).toMatchObject({ kind: 'interview', label: 'Figma interview', days: 2 })
    expect(pickNextDeadline(apps.slice(0, 2), [], now)).toMatchObject({ kind: 'offer', label: 'Ramp offer', days: 3 })
  })
  it('an offer wins a tie, and past or closed ones are skipped', () => {
    const apps = [
      { company: 'A', stage: 'Applied', oaDueDate: '2026-10-12' },
      { company: 'B', stage: 'Offer', offerDeadline: '2026-10-12' },
      { company: 'C', stage: 'Accepted', offerDeadline: '2026-10-10' },
      { company: 'D', stage: 'Technical', interviewAt: new Date(2026, 9, 1).toISOString() },
    ]
    expect(pickNextDeadline(apps, [], now).company).toBe('B')
  })
  it('an interview earlier today is over; a later one, or a date with no time, still counts', () => {
    const at = h => new Date(2026, 9, 9, h).toISOString()
    expect(pickNextDeadline([{ company: 'A', stage: 'Technical', interviewAt: at(9), interviewTimeKnown: true }], [], now)).toBeNull()
    expect(pickNextDeadline([{ company: 'A', stage: 'Technical', interviewAt: at(15), interviewTimeKnown: true }], [], now)).toMatchObject({ days: 0 })
    expect(pickNextDeadline([{ company: 'A', stage: 'Technical', interviewAt: at(9), interviewTimeKnown: false }], [], now)).toMatchObject({ days: 0 })
  })
})

describe('offerDecisions', () => {
  it('lists open offers soonest deadline first, undated last', () => {
    const rows = offerDecisions([
      { id: 1, company: 'NoDate', stage: 'Offer' },
      { id: 2, company: 'Later', stage: 'Offer', offerDeadline: '2026-10-20' },
      { id: 3, company: 'Soon', stage: 'Offer', offerDeadline: '2026-10-11' },
      { id: 4, company: 'Took', stage: 'Accepted', offerDeadline: '2026-10-10' },
      { id: 5, company: 'Still interviewing', stage: 'Onsite' },
    ], now)
    expect(rows.map(r => r.company)).toEqual(['Soon', 'Later', 'NoDate'])
  })
})

describe('upcomingInterviews', () => {
  it('interviews from today through the window, soonest first', () => {
    const at = (d, h = 14) => new Date(2026, 9, d, h).toISOString()
    const rows = upcomingInterviews([
      { id: 1, company: 'Two', stage: 'Onsite', interviewAt: at(16) },
      { id: 2, company: 'Today', stage: 'Technical', interviewAt: at(9, 8) },
      { id: 3, company: 'Gone', stage: 'Technical', interviewAt: at(8) },
      { id: 4, company: 'Far', stage: 'Technical', interviewAt: at(30) },
      { id: 5, company: 'Dead', stage: 'Rejected', interviewAt: at(12) },
    ], { now, withinDays: 14 })
    expect(rows.map(r => r.company)).toEqual(['Today', 'Two'])
  })
  it('a timed interview earlier today is over (it moves to Send a thank-you)', () => {
    const at = h => new Date(2026, 9, 9, h).toISOString()
    const rows = upcomingInterviews([
      { id: 1, company: 'Done', stage: 'Technical', interviewAt: at(9), interviewTimeKnown: true },
      { id: 2, company: 'Later', stage: 'Technical', interviewAt: at(16), interviewTimeKnown: true },
    ], { now })
    expect(rows.map(r => r.company)).toEqual(['Later'])
  })
})
