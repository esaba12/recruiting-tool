// Seed data for the public, no-sign-in /demo route (see db.js's isDemoMode() branch and
// App.jsx's DemoApp). Entirely fictional — a sample CS student's job search, not any real
// person's data — so this is safe to seed for anonymous portfolio visitors. Dates are
// computed relative to "today" (not hardcoded) so the demo always looks current whenever
// someone visits, rather than drifting stale.
//
// Loaded only on /demo: App.jsx's DemoApp imports this module (its own chunk) and hands it
// to db.js setDemoData(); everything else reads it through db.js getDemoData().
//
// Shapes below intentionally match db.js's fetch* return shapes EXACTLY (camelCase, same
// keys) — the demo branch in db.js returns these arrays directly with zero mapping, so any
// component built against real data works unmodified against this data.

import { instantiateTemplate } from './lib/learning/templates.js'
import { PROBLEM_BY_SLUG } from './lib/learning/problemBank.js'
import { addDaysLocal } from './lib/dates.js'
import { rankCandidates, DEFAULT_PROFILE, DEFAULT_WEIGHTS } from './lib/discovery.js'
import { normalizeCompanyName } from './lib/networkGraph.js'
import { suggestSlots, formatSlot } from './lib/availability.js'

function daysFromNow(n) {
  return addDaysLocal(n)
}

// An instant n days out at a local hour, for interview times.
function atLocal(n, hour) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

let idCounter = 1000
export function nextDemoId() {
  return `demo-${idCounter++}`
}

export const DEMO_CONTACTS = [
  {
    id: 'demo-c1', name: 'Kelly Sanders', company: 'Stripe', role: 'Recruiter', email: 'kelly.sanders@stripe.com',
    linkedin: 'https://linkedin.com/in/example', source: 'Referral', status: '🟢 Warm', urgency: 'HIGH',
    lastInteraction: daysFromNow(-2), followUpDate: daysFromNow(1), notes: 'Moving me to the recruiter screen next week.',
    whatTheyDid: 'University recruiter for Stripe\'s infra team.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: true, scheduleBy: daysFromNow(2),
    scheduleNote: 'Wants to set up the recruiter screen', referralStatus: 'Not Asked', referredByName: null,
  },
  {
    id: 'demo-c2', name: 'Ryan Kowalski', company: 'Notion', role: 'SWE', email: 'ryan.kowalski@makenotion.com',
    linkedin: 'https://linkedin.com/in/example', source: 'Cold Outreach', status: '🟡 Cooling', urgency: 'MED',
    lastInteraction: daysFromNow(-9), followUpDate: daysFromNow(-1), notes: 'Great call about the infra team — said he\'d refer me.',
    whatTheyDid: 'SWE on the collaborative editing team, alum of the same program.', referredById: null, followUpDraft: '',
    followUpDraftTier: null, followUpDraftKind: '', isUMichAlum: true, affinity: ['Shared university'], wantsToSchedule: false,
    scheduleBy: null, scheduleNote: '', referralStatus: 'Asked', referredByName: null,
  },
  {
    id: 'demo-c3', name: 'Emma Whitfield', company: 'Figma', role: 'PM', email: 'emma.whitfield@figma.com',
    linkedin: '', source: 'LinkedIn', status: '🟢 Warm', urgency: 'MED',
    lastInteraction: daysFromNow(-4), followUpDate: daysFromNow(3), notes: 'Sent a great intro doc about the PM internship rotation.',
    whatTheyDid: 'PM on Figma\'s dev-mode team.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
    referralStatus: 'Not Asked', referredByName: null,
  },
  {
    id: 'demo-c4', name: 'Deepak Nair', company: 'Anthropic', role: 'SWE', email: 'deepak.nair@anthropic.com',
    linkedin: '', source: 'Career Fair', status: '⭐ Champion', urgency: 'HIGH',
    lastInteraction: daysFromNow(-1), followUpDate: daysFromNow(2), notes: 'Championing my app internally, said he\'d ping the hiring manager.',
    whatTheyDid: 'SWE on model behavior — met at the fall career fair.', referredById: null, followUpDraft: '',
    followUpDraftTier: null, followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null,
    scheduleNote: '', referralStatus: 'Yes', referredByName: null,
  },
  {
    id: 'demo-c5', name: 'Brendan Walsh', company: 'Ramp', role: 'SWE', email: 'brendan.walsh@ramp.com',
    linkedin: '', source: 'Referral', status: '🔴 Cold', urgency: 'LOW',
    lastInteraction: daysFromNow(-32), followUpDate: null, notes: 'Coffee chat a month ago, no response since.',
    whatTheyDid: 'SWE on Ramp\'s platform team.', referredById: 'demo-c2', followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
    referralStatus: 'Not Asked', referredByName: 'Ryan Kowalski',
  },
  {
    id: 'demo-c6', name: 'Amara Osei', company: 'Vercel', role: 'SWE', email: 'amara.osei@vercel.com',
    linkedin: '', source: 'LinkedIn', status: '🟡 Cooling', urgency: 'MED',
    lastInteraction: daysFromNow(-11), followUpDate: daysFromNow(-3), notes: 'Answered a few questions about the interview loop.',
    whatTheyDid: 'SWE on the Next.js team.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: true, affinity: ['Shared university'], wantsToSchedule: false, scheduleBy: null,
    scheduleNote: '', referralStatus: 'Not Asked', referredByName: null,
  },
  {
    id: 'demo-c7', name: 'Liam Foster', company: 'Airbnb', role: 'Alumni', email: 'liam.foster@alumni.example.com',
    linkedin: '', source: 'Alumni Network', status: '✅ Closed', urgency: 'LOW',
    lastInteraction: daysFromNow(-60), followUpDate: null, notes: 'Great chat, but he switched teams — dead end for now.',
    whatTheyDid: 'Former SWE at Airbnb, now at a startup.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: true, affinity: ['Shared university'], wantsToSchedule: false, scheduleBy: null,
    scheduleNote: '', referralStatus: 'Not Asked', referredByName: null,
  },
  {
    id: 'demo-c8', name: 'Naomi Patel', company: 'Morgan Stanley', role: 'Analyst', email: 'naomi.patel@example.com',
    linkedin: '', source: 'Coffee chat', status: '🟢 Warm', urgency: 'HIGH',
    lastInteraction: daysFromNow(-3), followUpDate: daysFromNow(4), notes: 'Walked me through the Superday format and what the MDs care about.',
    whatTheyDid: 'First-year analyst in the M&A group, alum of the same program.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: true, affinity: ['Shared university'], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
    referralStatus: 'Yes', referredByName: null,
  },
  {
    id: 'demo-c9', name: 'Priya Raman', company: 'Datadog', role: 'SWE', email: 'priya.raman@datadoghq.com',
    linkedin: '', source: 'Alumni Network', status: '🟢 Warm', urgency: 'MED',
    lastInteraction: daysFromNow(-1), followUpDate: daysFromNow(3), notes: 'Coffee chat booked from her calendar invite. Ask about the observability intern team.',
    whatTheyDid: 'SWE on the metrics pipeline, alum of the same program.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: true, affinity: ['Shared university'], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
    referralStatus: 'Not Asked', referredByName: null,
  },
  {
    id: 'demo-c10', name: 'Marcus Chen', company: 'Linear', role: 'SWE', email: 'marcus@linear.example.com',
    linkedin: 'https://linkedin.com/in/example', source: 'Cold Outreach', status: '🟡 Cooling', urgency: 'LOW',
    lastInteraction: daysFromNow(-6), followUpDate: daysFromNow(1), notes: 'Cold email about how Linear runs internships. No reply yet.',
    whatTheyDid: 'Early engineer on the sync engine.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
    referralStatus: 'Not Asked', referredByName: null,
  },
  {
    id: 'demo-c11', name: 'Sofia Alvarez', company: 'Stripe', role: 'SWE', email: 'sofia.alvarez@stripe.com',
    linkedin: '', source: 'Referral', status: '🟢 Warm', urgency: 'MED',
    lastInteraction: daysFromNow(-5), followUpDate: null, notes: 'Kelly intro\'d us. Interned on Stripe infra last summer, shared her prep doc.',
    whatTheyDid: 'Return-offer SWE on the payments infra team.', referredById: 'demo-c1', followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
    referralStatus: 'Not Asked', referredByName: 'Kelly Sanders',
  },
  {
    id: 'demo-c12', name: 'Jordan Lee', company: 'Jane Street', role: 'Recruiter', email: 'jordan.lee@example.com',
    linkedin: '', source: 'Career Fair', status: '🔴 Cold', urgency: 'LOW',
    lastInteraction: daysFromNow(-12), followUpDate: null, notes: 'Met at the fair. Applied, then rejected after the OA. Keep warm for next cycle.',
    whatTheyDid: 'Campus recruiter for SWE and trading internships.', referredById: null, followUpDraft: '', followUpDraftTier: null,
    followUpDraftKind: '', isUMichAlum: false, affinity: [], wantsToSchedule: false, scheduleBy: null, scheduleNote: '',
    referralStatus: 'Not Asked', referredByName: null,
  },
]

const SEED_APPLICATIONS = [
  { id: 'demo-a1', company: 'Stripe', role: 'SWE Intern, Infrastructure', stage: 'Phone Screen', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-14), closedDate: null, lastActivity: daysFromNow(-2), daysInStage: 14, jdLink: 'https://stripe.com/jobs', notes: 'Recruiter screen scheduled via Kelly.', createdTime: daysFromNow(-20), referredById: null },
  { id: 'demo-a2', company: 'Anthropic', role: 'SWE Intern', stage: 'Technical', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-21), closedDate: null, lastActivity: daysFromNow(-1), daysInStage: 6, jdLink: 'https://anthropic.com/careers', notes: 'First technical round went well.', createdTime: daysFromNow(-25), referredById: null, interviewAt: atLocal(2, 14), interviewTimeKnown: true },
  { id: 'demo-a3', company: 'Figma', role: 'PM Intern', stage: 'Applied', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-6), closedDate: null, lastActivity: daysFromNow(-4), daysInStage: 6, jdLink: 'https://figma.com/careers', notes: '', createdTime: daysFromNow(-6), referredById: null, oaDueDate: null, oaLink: 'https://codesignal.com/test/figma-pm-intern', oaCompleted: false, oaResearchCheckedAt: daysFromNow(-1) },
  { id: 'demo-a4', company: 'Vercel', role: 'SWE Intern', stage: 'Applied', triage: 'Applied', location: 'Remote', sourceRepo: 'SimplifyJobs/Summer2027-Internships', appliedDate: daysFromNow(-18), closedDate: null, lastActivity: daysFromNow(-18), daysInStage: 18, jdLink: 'https://vercel.com/careers', notes: '', createdTime: daysFromNow(-18), referredById: null },
  { id: 'demo-a5', company: 'Ramp', role: 'SWE Intern', stage: 'Offer', triage: 'Applied', location: 'New York, NY', sourceRepo: '', appliedDate: daysFromNow(-40), closedDate: null, lastActivity: daysFromNow(-5), daysInStage: 5, jdLink: 'https://ramp.com/careers', notes: 'Offer received, deciding by end of month.', createdTime: daysFromNow(-45), referredById: 'demo-c5', offerDeadline: daysFromNow(9), offerDetails: { base: '$55/hr', bonus: '$5k relocation', location: 'New York, NY', start: 'June 2027' } },
  { id: 'demo-a6', company: 'Notion', role: 'SWE Intern', stage: 'Rejected', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-50), closedDate: daysFromNow(-10), lastActivity: daysFromNow(-10), daysInStage: 10, jdLink: '', notes: 'Didn\'t move past the first round.', createdTime: daysFromNow(-55), referredById: 'demo-c2' },
  { id: 'demo-a7', company: 'Airbnb', role: 'SWE Intern', stage: 'Wishlist', triage: 'Needs Review', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-1), daysInStage: null, jdLink: 'https://careers.airbnb.com', notes: '', createdTime: daysFromNow(-1), referredById: null },
  { id: 'demo-a8', company: 'Discord', role: 'SWE Intern', stage: 'Wishlist', triage: 'Needs Review', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-1), daysInStage: null, jdLink: 'https://discord.com/careers', notes: '', createdTime: daysFromNow(-1), referredById: null },
  { id: 'demo-a9', company: 'Rippling', role: 'SWE Intern', stage: 'Applied', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: daysFromNow(-3), closedDate: null, lastActivity: daysFromNow(-3), daysInStage: 3, jdLink: '', notes: '', createdTime: daysFromNow(-3), referredById: null, oaDueDate: daysFromNow(4), oaLink: 'https://hackerrank.com/test/rippling-swe-intern', oaCompleted: false, oaResearchCheckedAt: null },
  { id: 'demo-a10', company: 'Linear', role: 'SWE Intern', stage: 'Wishlist', triage: 'Maybe', location: 'Remote', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-2), daysInStage: null, jdLink: '', notes: 'Small team, not sure about internship structure yet.', createdTime: daysFromNow(-2), referredById: null },
  { id: 'demo-a11', company: 'Morgan Stanley', role: 'Investment Banking Summer Analyst', stage: 'Onsite', triage: 'Applied', location: 'New York, NY', sourceRepo: '', appliedDate: daysFromNow(-30), closedDate: null, lastActivity: daysFromNow(-3), daysInStage: 3, jdLink: 'https://example.com/careers', notes: 'Superday Friday — four back-to-back 30-min interviews (technicals + fit).', createdTime: daysFromNow(-35), referredById: 'demo-c8', interviewAt: atLocal(4, 12), interviewTimeKnown: false },
  { id: 'demo-a12', company: 'Datadog', role: 'Software Engineering Intern', stage: 'Offer', triage: 'Applied', location: 'New York, NY', sourceRepo: '', appliedDate: daysFromNow(-35), closedDate: null, lastActivity: daysFromNow(-2), daysInStage: 2, jdLink: 'https://example.com/careers', notes: 'Exploding offer: they asked for an answer within a week.', createdTime: daysFromNow(-38), referredById: null, offerDeadline: daysFromNow(5), offerDetails: { base: '$52/hr', bonus: '$3k signing', location: 'New York, NY', start: 'May 2027', notes: 'Team match after you accept' } },
]

// Stage history for the seeded apps above: [stage, daysAgo] in order. Feeds the outcome
// Sankey (Pipeline → Sheet → Flow, and Today) through db.js's attachStageHistory, the
// same path real application_stage_events rows take.
const SEED_PATHS = {
  'demo-a1': [['Applied', -14], ['Phone Screen', -8]],
  'demo-a2': [['Applied', -21], ['Phone Screen', -12], ['Technical', -6]],
  'demo-a3': [['Applied', -6]],
  'demo-a4': [['Applied', -18]],
  'demo-a5': [['Applied', -40], ['Phone Screen', -30], ['Technical', -20], ['Onsite', -12], ['Offer', -5]],
  'demo-a6': [['Applied', -50], ['Phone Screen', -35], ['Rejected', -10]],
  'demo-a9': [['Applied', -3]],
  'demo-a11': [['Applied', -30], ['Phone Screen', -20], ['Onsite', -3]],
}

// A wider spread of finished and stalled applications so the flow looks like a real
// season: mostly quiet rejections and ghosting, a few OAs, a handful of interviews.
// [company, role, path, source ('board' | contact id | null), oa]
const MORE_APPLICATIONS = [
  ['Datadog', 'SWE Intern', [['Applied', -62], ['Rejected', -40]], 'board'],
  ['Robinhood', 'SWE Intern, Backend', [['Applied', -58]], 'board'],
  ['Palantir', 'Forward Deployed SWE Intern', [['Applied', -55], ['Phone Screen', -44], ['Technical', -36], ['Rejected', -30]], null, true],
  ['Snowflake', 'SWE Intern', [['Applied', -54], ['Rejected', -47]], 'board'],
  ['Plaid', 'SWE Intern', [['Applied', -52]], 'board'],
  ['DoorDash', 'SWE Intern', [['Applied', -49], ['Rejected', -33]], 'board', true],
  ['Coinbase', 'SWE Intern', [['Applied', -48]], 'board'],
  ['Duolingo', 'SWE Intern', [['Applied', -46], ['Phone Screen', -38], ['Rejected', -31]], 'demo-c7'],
  ['Scale AI', 'SWE Intern', [['Applied', -45], ['Rejected', -44]], null],
  ['Two Sigma', 'Quant Dev Intern', [['Applied', -44], ['Rejected', -28]], null, true],
  ['Cloudflare', 'SWE Intern', [['Applied', -42]], 'board'],
  ['Asana', 'SWE Intern', [['Applied', -41], ['Rejected', -26]], 'board'],
  ['Brex', 'SWE Intern', [['Applied', -39], ['Phone Screen', -31], ['Technical', -22], ['Onsite', -15], ['Rejected', -9]], 'demo-c5'],
  ['Databricks', 'SWE Intern', [['Applied', -37], ['Rejected', -20]], 'board', true],
  ['Atlassian', 'SWE Intern', [['Applied', -36]], 'board'],
  ['HubSpot', 'SWE Intern', [['Applied', -33], ['Phone Screen', -21], ['Rejected', -14]], null],
  ['Jane Street', 'SWE Intern', [['Applied', -32], ['Rejected', -12]], null, true],
  ['Retool', 'SWE Intern', [['Applied', -28], ['Phone Screen', -16], ['Technical', -7]], 'demo-c6'],
  ['Square', 'SWE Intern', [['Applied', -25], ['Rejected', -18]], 'board'],
  ['MongoDB', 'SWE Intern', [['Applied', -22]], 'board', true],
  ['Shopify', 'Dev Intern', [['Applied', -16]], 'board'],
  ['Instacart', 'SWE Intern', [['Applied', -12], ['Rejected', -5]], 'board'],
  ['Pinterest', 'SWE Intern', [['Applied', -9]], 'board'],
  ['Hudson River Trading', 'SWE Intern', [['Applied', -7]], null, true],
]

const moreApplications = MORE_APPLICATIONS.map(([company, role, path, source, oa], i) => {
  const [, applied] = path[0]
  const [stage, last] = path[path.length - 1]
  const oaDue = oa ? applied + 7 : null
  return {
    id: `demo-a${100 + i}`, company, role, stage, triage: 'Applied', location: '',
    sourceRepo: source === 'board' ? 'SimplifyJobs/Summer2027-Internships' : '',
    appliedDate: daysFromNow(applied), closedDate: stage === 'Rejected' ? daysFromNow(last) : null,
    lastActivity: daysFromNow(oaDue && oaDue > last ? Math.min(oaDue, 0) : last), daysInStage: null,
    jdLink: '', notes: '', createdTime: daysFromNow(applied), referredById: source && source.startsWith('demo-c') ? source : null,
    oaDueDate: oaDue !== null ? daysFromNow(oaDue) : null, oaLink: null, oaCompleted: !!oa && oaDue < 0,
    oaResearchCheckedAt: null,
  }
})

export const DEMO_APPLICATIONS = [...SEED_APPLICATIONS, ...moreApplications]

function pathEvents(id, path) {
  return path.map(([stage, ago], i) => ({
    applicationId: id, fromStage: i ? path[i - 1][0] : null, toStage: stage,
    changedAt: daysFromNow(ago), source: 'user',
  }))
}

export const DEMO_STAGE_EVENTS = [
  ...Object.entries(SEED_PATHS).flatMap(([id, path]) => pathEvents(id, path)),
  ...MORE_APPLICATIONS.flatMap(([, , path], i) => pathEvents(`demo-a${100 + i}`, path)),
]

export const DEMO_INTERACTIONS = [
  { id: 'demo-i1', contactId: 'demo-c1', type: 'Email', direction: 'Inbound', date: daysFromNow(-2), channelRef: '', summary: 'Kelly confirmed the recruiter screen is being scheduled.', body: '' },
  { id: 'demo-i2', contactId: 'demo-c4', type: 'Call', direction: 'Outbound', date: daysFromNow(-1), channelRef: '', summary: 'Great 20-min call — Deepak is championing my application internally.', body: '' },
  { id: 'demo-i3', contactId: 'demo-c2', type: 'Call', direction: 'Outbound', date: daysFromNow(-9), channelRef: '', summary: 'Ryan walked me through the infra team\'s interview loop and offered a referral.', body: '' },
  { id: 'demo-i4', contactId: 'demo-c3', type: 'LinkedIn', direction: 'Inbound', date: daysFromNow(-4), channelRef: '', summary: 'Emma sent over a doc on Figma\'s PM rotation program.', body: '' },
  { id: 'demo-i5', contactId: 'demo-c6', type: 'LinkedIn', direction: 'Outbound', date: daysFromNow(-11), channelRef: '', summary: 'Asked Amara a few questions about Vercel\'s interview process.', body: '' },
  { id: 'demo-i6', contactId: 'demo-c5', type: 'Meeting', direction: 'Outbound', date: daysFromNow(-32), channelRef: '', summary: 'Coffee chat with Brendan about the Ramp platform team.', body: '' },
  { id: 'demo-i7', contactId: 'demo-c7', type: 'Meeting', direction: 'Outbound', date: daysFromNow(-60), channelRef: '', summary: 'Intro call through the alumni network.', body: '' },
  { id: 'demo-i8', contactId: 'demo-c8', type: 'Call', direction: 'Outbound', date: daysFromNow(-3), channelRef: '', summary: 'Naomi ran me through the Superday format and which technicals to drill (DCF, accretion/dilution).', body: '' },
  { id: 'demo-i9', contactId: 'demo-c11', type: 'Call', direction: 'Outbound', date: daysFromNow(-5), channelRef: '', summary: 'Sofia walked me through her infra intern project and the Stripe phone-screen format.', body: '' },
  { id: 'demo-i10', contactId: 'demo-c12', type: 'Meeting', direction: 'Inbound', date: daysFromNow(-40), channelRef: '', summary: 'Met Jordan at the career fair booth — talked about the SWE vs trading tracks.', body: '' },
  { id: 'demo-i11', contactId: 'demo-c9', type: 'LinkedIn', direction: 'Outbound', date: daysFromNow(-4), channelRef: '', summary: 'Messaged Priya through the alumni group asking for a quick chat.', body: '' },
]

// Inbox threads (see lib/inbox.js) — same rows the email pipeline writes: one per message,
// grouped by channelRef (the Gmail thread id). A mix of every inbox filter: an interview
// invite and a coffee-chat reply that need answers, a coding test, an offer, a rejection,
// an automated confirmation, and a sent cold email still waiting on a reply.
function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000).toISOString()
}
const ME = 'you@school.edu'
function demoEmail(id, thread, hrs, { meeting, ...over }) {
  const sentAt = hoursAgo(hrs)
  // Same lead lines as api/_lib/emailPipeline.js interactionRow().
  const lead = meeting ? [meeting.interviewAt, `📅 Meeting link: ${meeting.link}`].filter(Boolean).join('\n') : ''
  const body = over.body || ''
  return {
    id, type: 'Email', channelRef: thread, date: sentAt.slice(0, 10), sentAt, mailbox: ME,
    direction: 'Inbound', readAt: null, summary: (lead ? `${lead}\n\n${body}` : body).slice(0, 300), ...over,
  }
}

// Same format as api/_lib/emailPipeline.js interviewLine() (America/New_York default).
function demoInviteAt(days, hour) {
  const d = new Date(Date.now() + days * 86400000)
  d.setHours(hour, 0, 0, 0)
  return d
}
function demoInterviewLine(days, hour) {
  return `📅 Interview: ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(demoInviteAt(days, hour))}`
}
function demoInviteDay(days, hour) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(demoInviteAt(days, hour))
}
export const DEMO_EMAILS = [
  demoEmail('demo-e1', 'demo-t-anthropic', 3, {
    contactId: 'demo-c4', fromName: 'Deepak Nair', fromAddress: 'deepak.nair@anthropic.com', emailCategory: 'INTERVIEW_INVITE',
    subject: 'Next round — final interviews', body: `Hi!\n\nGreat news — the team loved your technical round and we'd like to move you to final interviews. They're two 45-minute sessions (one coding, one project deep-dive), all on Zoom.\n\nCould you send me 3–4 times that work next Tuesday through Thursday?\n\nBest,\nDeepak`,
  }),
  demoEmail('demo-e2', 'demo-t-figma', 30, {
    contactId: 'demo-c3', direction: 'Outbound', fromAddress: ME, readAt: hoursAgo(30), emailCategory: 'NEW_CONTACT',
    subject: 'Quick question about the PM internship', body: `Hi Emma,\n\nI'm a sophomore studying CS and I really enjoyed your talk on Figma's design-to-dev handoff. I'm applying to the PM internship and would love 15 minutes to hear what the rotation is actually like.\n\nThanks so much,\nAlex`,
  }),
  demoEmail('demo-e3', 'demo-t-figma', 6, {
    contactId: 'demo-c3', fromName: 'Emma Whitfield', fromAddress: 'emma.whitfield@figma.com', emailCategory: 'REPLY',
    subject: 'Re: Quick question about the PM internship', body: `Hey Alex — happy to chat! I'm free Thursday afternoon or Friday morning. Grab whichever works on my calendar and we'll do a quick video call.\n\nAttaching the rotation doc I mentioned too.\n\nEmma`,
  }),
  demoEmail('demo-e4', 'demo-t-rippling', 20, {
    fromName: 'Rippling Recruiting', fromAddress: 'no-reply@hackerrank.com', emailCategory: 'OA_INVITE',
    subject: 'Rippling — complete your coding assessment', body: `Hello,\n\nThank you for applying to the Software Engineer Intern role at Rippling. As the next step, please complete a 70-minute online coding assessment on HackerRank.\n\nThe assessment must be completed within 4 days of receiving this email.\n\nGood luck!\nRippling Recruiting`,
  }),
  demoEmail('demo-e5', 'demo-t-ramp', 5 * 24, {
    contactId: 'demo-c5', fromName: 'Ramp Recruiting', fromAddress: 'recruiting@ramp.com', emailCategory: 'OFFER', readAt: hoursAgo(100),
    subject: 'Your offer from Ramp 🎉', body: `Hi Alex,\n\nWe're thrilled to offer you a Software Engineering Internship on our New York team for Summer 2027! Your offer letter is attached — please review it and let us know your decision by the end of the month.\n\nCongratulations,\nThe Ramp Recruiting Team`,
  }),
  demoEmail('demo-e6', 'demo-t-notion', 10 * 24, {
    contactId: 'demo-c2', fromName: 'Notion Careers', fromAddress: 'no-reply@greenhouse.io', emailCategory: 'REJECTION', readAt: hoursAgo(230),
    subject: 'Update on your Notion application', body: `Hi Alex,\n\nThank you for your interest in Notion and for the time you spent interviewing with us. After careful consideration, we've decided not to move forward with your application at this time.\n\nWe'd encourage you to apply again in the future.\n\nNotion Recruiting`,
  }),
  demoEmail('demo-e7', 'demo-t-figma-app', 6 * 24, {
    fromName: 'Figma', fromAddress: 'no-reply@greenhouse-mail.io', emailCategory: 'APPLICATION_CONFIRMATION', readAt: hoursAgo(140),
    subject: 'Thanks for applying to Figma!', body: `Hi Alex,\n\nThanks for applying to the Product Manager Intern role. We've received your application and our team is reviewing it now. We'll be in touch if your background is a fit.\n\nFigma Recruiting`,
  }),
  demoEmail('demo-e8', 'demo-t-vercel', 4 * 24, {
    contactId: 'demo-c6', direction: 'Outbound', fromAddress: ME, readAt: hoursAgo(96), emailCategory: 'FOLLOW_UP_NEEDED',
    subject: 'Following up — Vercel SWE internship', body: `Hi Amara,\n\nThanks again for walking me through the interview loop last week! I just submitted my application for the SWE internship — if you're comfortable, I'd really appreciate a referral.\n\nBest,\nAlex`,
  }),
  // Calendar invites, the way the serverless scan logs them (v1.3 spec 12): an interview's
  // newest message leads with the 📅 time read from the .ics, plus its meeting link. Priya's
  // coffee chat also came as an invite, but it's networking, so it gets the link and no time.
  demoEmail('demo-e9', 'demo-t-stripe-screen', 26, {
    contactId: 'demo-c1', fromName: 'Kelly Sanders', fromAddress: 'kelly.sanders@stripe.com', emailCategory: 'INTERVIEW_INVITE', readAt: hoursAgo(25),
    subject: `Invitation: Stripe Recruiter Screen @ ${demoInviteDay(2, 14)}`,
    body: `Hi Alex,\n\nSending over the invite for your recruiter screen — 30 minutes on Zoom, mostly about your projects and what you'd want from an infra internship. Nothing technical yet.\n\nLooking forward to it!\nKelly`,
    meeting: { link: 'https://stripe.zoom.us/j/00000000000', interviewAt: demoInterviewLine(2, 14) },
  }),
  demoEmail('demo-e10', 'demo-t-stripe-screen', 22, {
    contactId: 'demo-c1', direction: 'Outbound', fromAddress: ME, readAt: hoursAgo(22), emailCategory: null,
    subject: `Re: Invitation: Stripe Recruiter Screen @ ${demoInviteDay(2, 14)}`,
    body: `Hi Kelly — accepted, thanks so much! Talk then.\n\nAlex`,
  }),
  demoEmail('demo-e11', 'demo-t-ms-superday', 2 * 24, {
    contactId: 'demo-c8', fromName: 'Morgan Stanley Campus Recruiting', fromAddress: 'campus.recruiting@example.com', emailCategory: 'INTERVIEW_INVITE', readAt: hoursAgo(46),
    subject: 'Superday confirmation — Investment Banking Summer Analyst',
    body: `Dear Alex,\n\nCongratulations — we're pleased to invite you to our Superday. You'll have four 30-minute interviews with members of the M&A and Coverage groups, held on Microsoft Teams. The calendar invite is attached.\n\nPlease join five minutes early to test your audio.\n\nMorgan Stanley Campus Recruiting`,
    meeting: { link: 'https://teams.microsoft.com/l/meetup-join/demo', interviewAt: demoInterviewLine(3, 9) },
  }),
  demoEmail('demo-e12', 'demo-t-datadog', 4 * 24, {
    contactId: 'demo-c9', direction: 'Outbound', fromAddress: ME, readAt: hoursAgo(96), emailCategory: 'NEW_CONTACT',
    subject: 'Fellow Demo U alum — quick chat about Datadog?', body: `Hi Priya,\n\nI found you through the alumni directory — I'm a sophomore in CS and really curious about the metrics pipeline team. Would you be up for a 20-minute chat sometime next week?\n\nThanks!\nAlex`,
  }),
  demoEmail('demo-e13', 'demo-t-datadog', 18, {
    contactId: 'demo-c9', fromName: 'Priya Raman', fromAddress: 'priya.raman@datadoghq.com', emailCategory: 'REPLY',
    subject: 'Invitation: Coffee chat — Priya / Alex', body: `Of course! Sent you an invite for Thursday — it's on Google Meet. Bring any questions about the intern teams.\n\nPriya`,
    meeting: { link: 'https://meet.google.com/abc-defg-hij' },
  }),
  demoEmail('demo-e14', 'demo-t-linear', 6 * 24, {
    contactId: 'demo-c10', direction: 'Outbound', fromAddress: ME, readAt: hoursAgo(144), emailCategory: 'FOLLOW_UP_NEEDED',
    subject: 'How does Linear think about interns?', body: `Hi Marcus,\n\nI've been using Linear for my club's projects and loved your post on the sync engine. Linear doesn't list a formal internship — is that something the team would ever consider? I'd love 15 minutes to learn how you all think about it.\n\nBest,\nAlex`,
  }),
  demoEmail('demo-e15', 'demo-t-stripe-sofia', 5 * 24, {
    contactId: 'demo-c11', direction: 'Outbound', fromAddress: ME, readAt: hoursAgo(120), emailCategory: 'REPLY',
    subject: 'Thank you!', body: `Hi Sofia,\n\nThanks for the call and for sharing your prep doc — the system-design notes are gold. I'll let you know how the screen goes!\n\nAlex`,
  }),
  demoEmail('demo-e16', 'demo-t-janestreet', 12 * 24, {
    contactId: 'demo-c12', fromName: 'Jane Street Recruiting', fromAddress: 'no-reply@example.com', emailCategory: 'REJECTION', readAt: hoursAgo(280),
    subject: 'Your Jane Street application', body: `Hi Alex,\n\nThank you for completing the online assessment. Unfortunately, we won't be moving forward this cycle. We hope you'll apply again next year.\n\nJane Street Recruiting`,
  }),
]

export const DEMO_CONTACT_RELATIONSHIPS = [
  { id: 'demo-r1', fromContactId: 'demo-c2', toContactId: 'demo-c5', relationshipType: 'Introduced To', note: '' },
  { id: 'demo-r2', fromContactId: 'demo-c6', toContactId: 'demo-c2', relationshipType: 'College Friend Of', note: '' },
  { id: 'demo-r3', fromContactId: 'demo-c7', toContactId: 'demo-c3', relationshipType: 'Mentor Of', note: '' },
]

export const DEMO_CALLS = [
  {
    id: 'demo-cl1', title: 'Deepak Nair @ Anthropic', contactId: 'demo-c4', date: daysFromNow(-1),
    summary: 'Discussed the model behavior team\'s current projects and the internship interview loop.',
    keyInsights: 'Team is growing fast; he\'ll flag my app to the hiring manager this week.',
    fullTranscript: '',
  },
  {
    id: 'demo-cl2', title: 'Ryan Kowalski @ Notion', contactId: 'demo-c2', date: daysFromNow(-9),
    summary: 'Deep dive on Notion\'s collaborative editing infra and what the intern project scope usually looks like.',
    keyInsights: 'Referrals go through an internal form; he\'ll submit one this week.',
    fullTranscript: '',
  },
  {
    id: 'demo-cl3', title: 'Brendan Walsh @ Ramp', contactId: 'demo-c5', date: daysFromNow(-32),
    summary: 'Coffee chat about Ramp\'s platform team and general internship search advice.',
    keyInsights: 'Suggested applying early since their intern class fills up fast.',
    fullTranscript: '',
  },
]

// ── Recruiting Events (school-scoped shared pool + per-user overlays) ──────────
// Shapes match db.js's fetchSchoolEvents / fetchMyEventState return shapes. One
// fictional campus; events are dated relative to today so the demo's stale badge,
// overdue requirement, and upcoming fair all render regardless of when it's viewed.

function hoursFromNow(days, hour, minutes = 0) {
  const d = new Date(Date.now() + days * 86400000)
  d.setHours(hour, minutes, 0, 0)
  return d.toISOString()
}

export const DEMO_SCHOOLS = [
  {
    id: 'demo-s1', slug: 'demo-u', name: 'Demo University', emailDomain: 'demo-u.edu', timezone: 'America/Detroit',
    feedConfig: { sources: [{ kind: 'localist', base: 'https://events.demo-u.edu', groupId: 1, label: 'Engineering Career Center' }] },
    termWindows: [{ name: 'Fall 2026', start: '2026-08-10', end: '2026-12-31' }],
    transitBufferMin: 15,
  },
]

export const DEMO_EMPLOYERS = [
  { id: 'demo-e1', name: 'Stripe', normalizedName: 'stripe', website: 'https://stripe.com' },
  { id: 'demo-e2', name: 'Anthropic', normalizedName: 'anthropic', website: 'https://anthropic.com' },
  { id: 'demo-e3', name: 'Figma', normalizedName: 'figma', website: 'https://figma.com' },
  { id: 'demo-e4', name: 'Ramp', normalizedName: 'ramp', website: 'https://ramp.com' },
]

const evBase = {
  schoolId: 'demo-s1', visibility: 'shared', contributedBy: null, description: '', location: '', isVirtual: false,
  allDay: false, timezone: 'America/Detroit', url: null, registrationUrl: null, registrationDeadline: null,
  employerId: null, sourceKind: 'localist', sourceRef: null, confidence: 1, archived: false, attributes: null, requirements: [],
}

export const DEMO_EVENTS = [
  {
    ...evBase, id: 'demo-ev1', kind: 'career_fair', title: 'Fall Engineering Career Fair',
    description: 'Two-day fair with 200+ employers. Tech companies concentrated on day one.',
    location: 'Duderstadt Center', startsAt: hoursFromNow(9, 10), endsAt: hoursFromNow(9, 16),
    url: 'https://events.demo-u.edu/event/fall-fair', registrationUrl: 'https://careerfair.demo-u.edu/register',
    registrationDeadline: hoursFromNow(4, 23, 59), sourceRef: 'localist-1001', sourceLastVerifiedAt: hoursFromNow(-1, 6),
    attributes: { roles: ['SWE', 'PM'], majors: ['CS', 'CE', 'DS'], term: 'Fall 2026', format: 'in_person', sponsorship: 'unknown', employerIds: ['demo-e1', 'demo-e2', 'demo-e4'] },
    requirements: [
      { id: 'demo-rq1', eventId: 'demo-ev1', stepOrder: 1, kind: 'register', label: 'Register on Career Fair Plus', url: 'https://careerfair.demo-u.edu/register', dueAt: hoursFromNow(4, 23, 59), required: true },
      { id: 'demo-rq2', eventId: 'demo-ev1', stepOrder: 2, kind: 'upload_resume', label: 'Upload résumé to the fair portal', url: null, dueAt: hoursFromNow(6, 23, 59), required: true },
      { id: 'demo-rq3', eventId: 'demo-ev1', stepOrder: 3, kind: 'rsvp_external', label: 'RSVP for the Stripe pre-fair mixer', url: 'https://stripe.com/events', dueAt: hoursFromNow(7, 17), required: false },
    ],
  },
  {
    ...evBase, id: 'demo-ev2', kind: 'info_session', title: 'Anthropic Info Session + Q&A',
    description: 'Engineers from the model behavior team on what an intern project looks like.',
    location: 'BBB 1670', startsAt: hoursFromNow(3, 18), endsAt: hoursFromNow(3, 19, 30),
    employerId: 'demo-e2', registrationUrl: 'https://demo-u.joinhandshake.com/events/1', registrationDeadline: hoursFromNow(2, 12),
    sourceKind: 'paste', sourceRef: null, sourceLastVerifiedAt: hoursFromNow(-2, 9), confidence: 0.86,
    attributes: { roles: ['SWE'], majors: ['CS'], term: 'Fall 2026', format: 'in_person', sponsorship: 'yes', employerIds: ['demo-e2'] },
    requirements: [
      { id: 'demo-rq4', eventId: 'demo-ev2', stepOrder: 1, kind: 'register', label: 'RSVP on Handshake', url: 'https://demo-u.joinhandshake.com/events/1', dueAt: hoursFromNow(2, 12), required: true },
      { id: 'demo-rq5', eventId: 'demo-ev2', stepOrder: 2, kind: 'email_recruiter_to_confirm', label: 'Email the recruiter to confirm your spot', url: null, dueAt: hoursFromNow(-1, 17), required: true },
    ],
  },
  {
    ...evBase, id: 'demo-ev3', kind: 'coffee_chat', title: 'Figma PM Coffee Chats (15-min slots)',
    location: 'Virtual', isVirtual: true, startsAt: hoursFromNow(5, 13), endsAt: hoursFromNow(5, 16),
    employerId: 'demo-e3', registrationUrl: 'https://figma.com/students', sourceRef: 'localist-1004', sourceLastVerifiedAt: hoursFromNow(0, 6),
    attributes: { roles: ['PM'], majors: [], term: 'Fall 2026', format: 'virtual', sponsorship: 'unknown', employerIds: ['demo-e3'] },
    requirements: [
      { id: 'demo-rq6', eventId: 'demo-ev3', stepOrder: 1, kind: 'apply_first', label: 'Apply to the PM Intern role first', url: 'https://figma.com/careers', dueAt: hoursFromNow(3, 23, 59), required: true },
      { id: 'demo-rq7', eventId: 'demo-ev3', stepOrder: 2, kind: 'invite_only_selection', label: 'Selected applicants receive a slot invite', url: null, dueAt: null, required: true },
    ],
  },
  {
    ...evBase, id: 'demo-ev4', kind: 'workshop', title: 'Career Cafe: Technical Interview Prep',
    location: 'Career Center, Rm 2', startsAt: hoursFromNow(1, 12), endsAt: hoursFromNow(1, 13),
    sourceRef: 'localist-1007', sourceLastVerifiedAt: hoursFromNow(0, 6),
    attributes: { roles: ['SWE'], majors: [], term: 'Fall 2026', format: 'in_person', sponsorship: 'unknown', employerIds: [] },
  },
  {
    ...evBase, id: 'demo-ev5', kind: 'networking', title: 'Ramp x Demo U Alumni Mixer',
    location: 'Ross School, Winter Garden', startsAt: hoursFromNow(12, 17, 30), endsAt: hoursFromNow(12, 19, 30),
    employerId: 'demo-e4', sourceRef: 'localist-1011', sourceLastVerifiedAt: hoursFromNow(-21, 6),  // > 14d ⇒ stale badge
    attributes: { roles: ['SWE', 'PM'], majors: [], term: 'Fall 2026', format: 'in_person', sponsorship: 'no', employerIds: ['demo-e4'] },
  },
  {
    ...evBase, id: 'demo-ev6', kind: 'coffee_chat', title: 'Coffee with Liam (Airbnb alum)', visibility: 'private', contributedBy: 'demo-user',
    location: 'Sweetwaters, State St', startsAt: hoursFromNow(2, 9), endsAt: hoursFromNow(2, 9, 45),
    sourceKind: 'manual', sourceLastVerifiedAt: hoursFromNow(0, 6),
  },
]

export const DEMO_USER_EVENTS = [
  { userId: 'demo-user', eventId: 'demo-ev1', status: 'registering', calendarSlot: null, calendarEventId: null, calendarSyncedAt: null, notes: 'Target Stripe + Anthropic booths first.', followupDueAt: null, followupDoneAt: null, blockOverrides: {} },
  { userId: 'demo-user', eventId: 'demo-ev2', status: 'registering', calendarSlot: null, calendarEventId: null, calendarSyncedAt: null, notes: '', followupDueAt: null, followupDoneAt: null, blockOverrides: {} },
  { userId: 'demo-user', eventId: 'demo-ev4', status: 'attended', calendarSlot: null, calendarEventId: null, calendarSyncedAt: null, notes: '', followupDueAt: hoursFromNow(-2, 9), followupDoneAt: null, blockOverrides: {} },
]

export const DEMO_EVENT_RELEVANCE = [
  { userId: 'demo-user', eventId: 'demo-ev1', score: 9.2, tier: 'high', reason: '3 target employers attending; SWE + PM roles', overrideTier: null, dismissedAt: null },
  { userId: 'demo-user', eventId: 'demo-ev2', score: 8.7, tier: 'high', reason: 'Active Anthropic application; you know Deepak there', overrideTier: null, dismissedAt: null },
  { userId: 'demo-user', eventId: 'demo-ev3', score: 6.1, tier: 'medium', reason: 'PM track; Figma application in progress', overrideTier: null, dismissedAt: null },
  { userId: 'demo-user', eventId: 'demo-ev4', score: 4.0, tier: 'low', reason: 'General prep workshop', overrideTier: null, dismissedAt: null },
  { userId: 'demo-user', eventId: 'demo-ev5', score: 7.4, tier: 'medium', reason: 'Ramp offer pending; source unverified for 3 weeks', overrideTier: null, dismissedAt: null },
]

export const DEMO_REQUIREMENT_COMPLETIONS = [
  { userId: 'demo-user', requirementId: 'demo-rq1', completedAt: hoursFromNow(-1, 20) },
  { userId: 'demo-user', requirementId: 'demo-rq4', completedAt: hoursFromNow(-3, 11) },
]

export const DEMO_INGEST_SOURCES = [
  { id: 'demo-is1', schoolId: 'demo-s1', kind: 'localist', ref: '1', label: 'Engineering Career Center', lastRunAt: hoursFromNow(0, 6), lastSuccessAt: hoursFromNow(0, 6), lastCount: 4, degradedAt: null, degradedReason: null },
  { id: 'demo-is2', schoolId: 'demo-s1', kind: 'localist', ref: '9', label: 'Student Org Fairs (legacy mirror)', lastRunAt: hoursFromNow(0, 6), lastSuccessAt: hoursFromNow(-30, 6), lastCount: 0, degradedAt: hoursFromNow(0, 6), degradedReason: 'Feed returned events dated 2023 for a Fall 2026 query' },
]

// ── Learn tab (interview prep) ────────────────────────────────────────────────
// A seeded SWE track with ~5 weeks of plausible practice, built from the real template +
// problem bank so the demo exercises the same mastery/gap/goal code the real app does.

export function buildDemoLearning() {
  const { track, topics } = instantiateTemplate('swe')
  const trackRow = { id: 'demo-lt1', ...track, sort: 0, archivedAt: null }
  trackRow.config.leetcodeUsername = DEMO_LC_USERNAME
  const topicRows = topics.map((t, i) => ({ id: `demo-lp${i}`, trackId: trackRow.id, hidden: false, selfRating: null, ...t }))
  const byName = n => topicRows.find(t => t.name === n)?.id

  const solves = [
    ['two-sum', 34, 'solved'], ['valid-anagram', 33, 'solved'], ['group-anagrams', 31, 'solved'], ['top-k-frequent-elements', 30, 'hinted'],
    ['valid-palindrome', 27, 'solved'], ['3sum', 26, 'failed'], ['container-with-most-water', 24, 'solved'],
    ['longest-substring-without-repeating-characters', 20, 'hinted'], ['minimum-window-substring', 19, 'failed'],
    ['valid-parentheses', 16, 'solved'], ['daily-temperatures', 15, 'hinted'], ['binary-search', 13, 'solved'],
    ['invert-binary-tree', 9, 'solved'], ['maximum-depth-of-binary-tree', 8, 'solved'], ['binary-tree-level-order-traversal', 6, 'solved'],
    ['validate-binary-search-tree', 5, 'hinted'], ['number-of-islands', 3, 'solved'], ['course-schedule', 2, 'failed'],
    ['3sum', 1, 'solved'], ['coin-change', 1, 'failed'],
  ]
  const items = []
  const logs = []
  for (const [slug, d, outcome] of solves) {
    const p = PROBLEM_BY_SLUG.get(slug)
    let item = items.find(i => i.externalRef === slug)
    if (!item) {
      item = { id: `demo-li${items.length}`, source: 'leetcode', externalRef: slug, title: p.title, url: p.url, difficulty: p.difficulty, tags: p.tags, srs: null, dueAt: null }
      items.push(item)
    }
    if (outcome !== 'solved') item.dueAt = new Date(Date.now() + (d - 2) * 86400000).toISOString()
    logs.push({ id: nextDemoId(), trackId: trackRow.id, topicIds: [], itemId: item.id, applicationId: null, kind: 'problem', source: 'manual', externalRef: null,
      title: p.title, difficulty: p.difficulty, outcome, minutes: 25 + (d % 4) * 10, confidence: outcome === 'solved' ? 4 : 2, score: null, notes: '',
      occurredAt: new Date(Date.now() - d * 86400000).toISOString() })
  }
  const sessions = [
    ['Caching', 'session', 12, null, 45], ['Scaling fundamentals', 'explain_back', 10, 3, null], ['Joins', 'session', 7, null, 30],
    ['Window functions', 'explain_back', 4, 2, null], ['What happens when you type a URL', 'explain_back', 2, 4, null], ['Design case studies', 'mock', 1, 3, 60],
  ]
  for (const [name, kind, d, score, minutes] of sessions) {
    logs.push({ id: nextDemoId(), trackId: trackRow.id, topicIds: [byName(name)], itemId: null, applicationId: null, kind, source: 'manual', externalRef: null,
      title: name, difficulty: null, outcome: null, minutes, confidence: score, score, notes: '', occurredAt: new Date(Date.now() - d * 86400000).toISOString() })
  }

  // A second, finance-flavored track so IB/consulting friends see themselves — explain-backs
  // and mocks are the evidence source there, since there's no problem bank.
  const ib = instantiateTemplate('ib')
  const ibTrack = { id: 'demo-lt2', ...ib.track, sort: 1, archivedAt: null }
  const ibTopics = ib.topics.map((t, i) => ({ id: `demo-ibp${i}`, trackId: ibTrack.id, hidden: false, selfRating: null, ...t }))
  const ibId = n => ibTopics.find(t => t.name === n)?.id
  const ibSessions = [
    ['Three financial statements', 'explain_back', 14, 4, null], ['Walk a change through the statements', 'explain_back', 11, 3, null],
    ['Enterprise value vs equity value', 'explain_back', 8, 4, null], ['DCF', 'explain_back', 5, 3, null],
    ['DCF', 'session', 4, null, 50], ['M&A: accretion / dilution', 'explain_back', 2, 2, null],
    ['Behavioral / why banking', 'mock', 3, 4, 40], ['LBO', 'session', 1, null, 45],
  ]
  for (const [name, kind, d, score, minutes] of ibSessions) {
    logs.push({ id: nextDemoId(), trackId: ibTrack.id, topicIds: [ibId(name)], itemId: null, applicationId: null, kind, source: 'manual', externalRef: null,
      title: name, difficulty: null, outcome: null, minutes, confidence: score, score, notes: '', occurredAt: new Date(Date.now() - d * 86400000).toISOString() })
  }
  return { tracks: [trackRow, ibTrack], topics: [...topicRows, ...ibTopics], items, logs }
}

// What a LeetCode sync would have stored (lib/learning/leetcodeImport.js's snapshot): lifetime
// per-tag counts feed mastery as baseline evidence, and languages/languageStats drive the
// Languages widget. db.js serves it as the demo's `leetcode_snapshot` user setting.
const DEMO_LC_USERNAME = 'demo-student'
export function buildDemoLeetcodeSnapshot() {
  const day = 86400000
  return {
    username: DEMO_LC_USERNAME,
    difficulty: { All: 97, Easy: 52, Medium: 41, Hard: 4 },
    tagCounts: {
      array: 48, 'hash-table': 31, string: 24, sorting: 12, 'two-pointers': 14, 'sliding-window': 6, stack: 8,
      'monotonic-stack': 3, 'binary-search': 7, tree: 16, 'binary-tree': 16, 'depth-first-search': 13,
      'breadth-first-search': 9, graph: 6, 'linked-list': 5, heap: 3, 'heap-priority-queue': 3, backtracking: 3,
      'dynamic-programming': 5, greedy: 6, math: 8, 'prefix-sum': 4, matrix: 5,
    },
    languages: [{ name: 'Python3', solved: 81 }, { name: 'Java', solved: 22 }, { name: 'MySQL', solved: 9 }],
    languageStats: {
      byLang: {
        Python3: { solves: 15, firstTry: 9, struggled: 6, failed: 3, lastAt: Date.now() - day },
        Java: { solves: 4, firstTry: 2, struggled: 2, failed: 1, lastAt: Date.now() - 9 * day },
      },
      seen: [],
      since: Date.now() - 35 * day,
    },
    syncedIds: [],
    syncedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  }
}

// Static stand-in for useCompanyPrep's output (the real one reads the company-tagged lists
// through the auth-gated /gh-api proxy). Companies match the demo Pipeline's OA/interviews.
// Frequencies are illustrative; slugs and tags are real LeetCode problems from problemBank.js.
const companySet = (company, why, rows) => ({
  company, why, folder: company,
  problems: rows.map(([slug, frequency]) => {
    const p = PROBLEM_BY_SLUG.get(slug)
    return { slug, title: p.title, difficulty: p.difficulty, frequency, tags: p.tags }
  }),
})
export const DEMO_COMPANY_PREP = {
  sets: [
    companySet('Rippling', 'oa', [
      ['lru-cache', 100], ['merge-intervals', 88], ['time-based-key-value-store', 81], ['top-k-frequent-elements', 70],
      ['two-sum', 66], ['meeting-rooms-ii', 61], ['course-schedule', 55], ['insert-interval', 49], ['word-break', 44],
      ['number-of-islands', 40], ['kth-largest-element-in-an-array', 36], ['house-robber', 31], ['valid-parentheses', 28],
      ['longest-substring-without-repeating-characters', 25], ['coin-change', 22], ['task-scheduler', 19],
    ]),
    companySet('Stripe', 'interview', [
      ['time-based-key-value-store', 100], ['merge-intervals', 77], ['lru-cache', 72], ['group-anagrams', 58],
      ['two-sum', 54], ['valid-parentheses', 47], ['top-k-frequent-elements', 41], ['minimum-window-substring', 37],
      ['implement-trie-prefix-tree', 33], ['insert-interval', 30], ['product-of-array-except-self', 26],
      ['daily-temperatures', 23], ['search-in-rotated-sorted-array', 20], ['word-search', 18], ['3sum', 16],
    ]),
    companySet('Anthropic', 'interview', [
      ['lru-cache', 100], ['find-median-from-data-stream', 74], ['merge-k-sorted-lists', 69], ['course-schedule', 62],
      ['word-break', 55], ['number-of-islands', 51], ['clone-graph', 46], ['kth-largest-element-in-an-array', 42],
      ['longest-palindromic-substring', 37], ['rotting-oranges', 33], ['task-scheduler', 29], ['coin-change', 26],
      ['implement-trie-prefix-tree', 23], ['merge-intervals', 21], ['two-sum', 18],
    ]),
  ],
  unmatched: [], folders: [], loading: false, error: null,
}

// ── Settings / Grow / Job Boards (signed-in-only surfaces, shown in the demo) ───
// Grow's caches and Job Boards' tracked boards are read through lib/scopedStorage.js, which
// DemoApp switches to an in-memory store seeded by buildDemoStorage(). GitHub boards and
// Gmail/Calendar status come from demo branches in github.js and lib/googleAuth.js. No AI,
// Exa or GitHub call is made: lib/keyStore.js assertKey() refuses on /demo.

export const DEMO_PROFILE = {
  full_name: 'Alex Rivera', school: 'Demo University', school_id: 'demo-s1', grad_year: 2028,
  tracks: ['swe', 'pm'], ai_provider: 'claude',
}

export function demoGmailConnections() {
  const lastScannedAt = new Date(Date.now() - 7 * 60000).toISOString()
  return [
    { email: ME, lastScannedAt },
    { email: 'alex.rivera@example.com', lastScannedAt },
  ]
}

export const DEMO_TARGET_COMPANIES = ['Stripe', 'Anthropic', 'Figma', 'Datadog', 'Linear', 'Databricks', 'Vercel', 'Jane Street']

// What Explore (Grow → Companies) would have ranked for this profile.
const DEMO_COMPANY_RESULTS = [
  { name: 'Modal', website: 'modal.com', oneLiner: 'Serverless GPUs and containers for running AI and data jobs in the cloud.', whyFit: 'Your distributed-systems coursework maps straight onto their scheduler and runtime work.', fitScore: 9, domain: 'Dev tools / Infra', stage: 'startup', badges: ['hiring interns', 'small team'] },
  { name: 'Mercury', website: 'mercury.com', oneLiner: 'Banking for startups, with a product-heavy engineering culture.', whyFit: 'Fintech like Stripe and Ramp, with a PM-friendly intern program for your second track.', fitScore: 8, domain: 'Fintech', stage: 'growth', badges: ['hiring interns'] },
  { name: 'Temporal', website: 'temporal.io', oneLiner: 'Open-source durable execution for long-running workflows.', whyFit: 'Open-source and infra-heavy — the kind of codebase you said you want to ship in.', fitScore: 8, domain: 'Dev tools / Infra', stage: 'growth', badges: ['open source'] },
  { name: 'Supabase', website: 'supabase.com', oneLiner: 'Open-source Postgres platform with auth, storage and realtime.', whyFit: 'You already build on it — an easy, specific opener for outreach.', fitScore: 7, domain: 'Dev tools / Infra', stage: 'growth', badges: ['remote-friendly'] },
  { name: 'Hex', website: 'hex.tech', oneLiner: 'Collaborative notebooks and data apps for analytics teams.', whyFit: 'Product-minded engineering with real PM overlap, close to Figma\'s collaborative feel.', fitScore: 7, domain: 'Enterprise / B2B', stage: 'growth', badges: [] },
  { name: 'Sierra', website: 'sierra.ai', oneLiner: 'Conversational AI agents for customer experience.', whyFit: 'AI applied to a concrete product, if you want to lean toward the AI side.', fitScore: 6, domain: 'AI / ML', stage: 'growth', badges: ['new grad + intern'] },
]

const DEMO_COMPANY_PREFS = {
  seedCompanies: ['Stripe', 'Vercel', 'Linear'], domains: ['Dev tools / Infra', 'Fintech'], roleLean: 0.7, stage: 'scaleup',
  priorities: ['Mentorship & learning', 'Ownership & impact'], locations: ['San Francisco', 'New York'], workStyle: 'Hybrid',
  extras: '', saved: true,
}

const DEMO_AFFINITY_PROFILE = {
  ...DEFAULT_PROFILE, university: 'Demo University', gradYear: '2028', pastEmployers: ['Demo U Research Lab'],
  programs: ['HackDemo'], skills: ['Python', 'TypeScript', 'Distributed systems'], weights: { ...DEFAULT_WEIGHTS },
}

// People that Discover (Grow → People) would have pulled from Exa, ranked with the real scorer.
const DEMO_PEOPLE = {
  Databricks: [
    { name: 'Hannah Okafor', title: 'Software Engineer, Delta Lake', school: 'Demo University', pastCompanies: ['Demo U Research Lab'], programs: [], linkedinUrl: 'https://linkedin.com/in/example-hannah' },
    { name: 'Ravi Menon', title: 'University Recruiter', school: null, pastCompanies: ['Google'], programs: [], linkedinUrl: 'https://linkedin.com/in/example-ravi' },
    { name: 'Chris Novak', title: 'Engineering Manager, Photon', school: 'State Tech', pastCompanies: [], programs: [], linkedinUrl: null },
  ],
  Linear: [
    { name: 'Elena Park', title: 'Product Engineer', school: 'Demo University', pastCompanies: [], programs: ['HackDemo'], linkedinUrl: 'https://linkedin.com/in/example-elena' },
  ],
  'Jane Street': [
    { name: 'Tom Becker', title: 'Software Engineer', school: 'Demo University', pastCompanies: [], programs: [], linkedinUrl: null },
    { name: 'Mei Lin', title: 'Quantitative Trader', school: 'Coastal College', pastCompanies: [], programs: [], linkedinUrl: null },
  ],
  Figma: [
    { name: 'Daniel Ortiz', title: 'Associate Product Manager', school: 'Demo University', pastCompanies: [], programs: [], linkedinUrl: 'https://linkedin.com/in/example-daniel' },
    { name: 'Grace Kim', title: 'Software Engineer, Dev Mode', school: null, pastCompanies: ['Notion'], programs: [], linkedinUrl: null },
  ],
}

// Two tracked boards; demoRepoJobs() is what github.js serves for them on /demo.
const DEMO_BOARDS = [
  { owner: 'SimplifyJobs', repo: 'Summer2027-Internships', label: 'SimplifyJobs — Summer 2027 Internships', enabled: true },
  { owner: 'speedyapply', repo: '2027-SWE-College-Jobs', label: 'speedyapply — SWE Internships & New Grad', enabled: true },
]

// [company, role, location, posted (days ago), closed?]
const BOARD_ROWS = {
  'simplifyjobs/summer2027-internships': [
    ['Stripe', 'SWE Intern, Infrastructure', 'San Francisco, CA', 22], ['Datadog', 'Software Engineering Intern', 'New York, NY', 3],
    ['Databricks', 'Software Engineering Intern', 'San Francisco, CA', 1], ['Modal', 'Software Engineer Intern', 'New York, NY', 2],
    ['Mercury', 'Software Engineering Intern', 'San Francisco, CA', 5], ['Mercury', 'Product Management Intern', 'San Francisco, CA', 5],
    ['Figma', 'Product Manager Intern', 'San Francisco, CA', 9], ['Temporal', 'Software Engineer Intern', 'Remote', 11],
    ['Robinhood', 'Software Engineering Intern, Backend', 'Menlo Park, CA', 60], ['Plaid', 'Software Engineer Intern', 'San Francisco, CA', 58],
    ['Snowflake', 'Software Engineer Intern', 'Bellevue, WA', 54, true], ['Hex', 'Software Engineering Intern', 'San Francisco, CA', 0],
    ['Duolingo', 'Software Engineer Intern', 'Pittsburgh, PA', 47, true], ['Sierra', 'Software Engineer Intern', 'San Francisco, CA', 4],
  ],
  'speedyapply/2027-swe-college-jobs': [
    ['Airbnb', 'SWE Intern', 'San Francisco, CA', 1], ['Discord', 'SWE Intern', 'San Francisco, CA', 1],
    ['Rippling', 'SWE Intern', 'San Francisco, CA', 6], ['Linear', 'SWE Intern', 'Remote', 2],
    ['Supabase', 'Software Engineer Intern', 'Remote', 3], ['Datadog', 'Software Engineering Intern', 'New York, NY', 3],
    ['Cloudflare', 'Software Engineer Intern', 'Austin, TX', 43], ['Pinterest', 'Software Engineer Intern', 'San Francisco, CA', 10],
    ['Coinbase', 'Software Engineer Intern', 'Remote', 49, true], ['Hudson River Trading', 'Software Engineer Intern', 'New York, NY', 8],
  ],
}

export function demoRepoJobs(owner, repo) {
  const key = `${owner}/${repo}`.toLowerCase()
  const rows = BOARD_ROWS[key]
  if (!rows) throw new Error('The demo only has its two sample boards — sign up to track any GitHub board.')
  const board = DEMO_BOARDS.find(b => `${b.owner}/${b.repo}`.toLowerCase() === key)
  return {
    repoName: `${board.owner}/${board.repo}`, repoUrl: `https://github.com/${board.owner}/${board.repo}`,
    description: board.label, stars: key.startsWith('simplify') ? 24800 : 3100, updatedAt: hoursAgo(2),
    jobs: rows.map(([company, role, location, ago, closed]) => ({
      company, role, location, applyUrl: `https://example.com/jobs/${normalizeCompanyName(company).replace(/\s+/g, '-')}`,
      dateAdded: daysFromNow(-ago), notes: '', status: closed ? 'closed' : 'open',
    })),
  }
}

// The scopedStorage seed: the same rec_* keys Explore, Discover and Job Boards read.
export function buildDemoStorage() {
  const now = Date.now()
  const discovered = {}
  const perCompany = {}
  for (const [company, people] of Object.entries(DEMO_PEOPLE)) {
    const key = normalizeCompanyName(company)
    const atCompany = DEMO_CONTACTS.filter(c => normalizeCompanyName(c.company) === key)
    discovered[key] = rankCandidates(people.map(p => ({ ...p, company })), DEMO_AFFINITY_PROFILE, atCompany, DEMO_CONTACTS)
    perCompany[key] = { lastRun: now - 5 * 3600000, resultHash: 'demo', count: people.length }
  }
  return {
    rec_company_prefs: DEMO_COMPANY_PREFS,
    rec_company_results: DEMO_COMPANY_RESULTS,
    rec_company_meta: { lastCheck: null, lastRun: now - 5 * 3600000, resultHash: 'demo' },
    rec_affinity_profile: DEMO_AFFINITY_PROFILE,
    rec_discovered: discovered,
    rec_discovery_meta: { lastCheck: null, perCompany },
    rec_tracked_boards: DEMO_BOARDS.map(b => ({ ...b, addedAt: now - 30 * 86400000 })),
  }
}

// Suggested replies (v1.4 spec 10) — what the Gmail scan writes to email_drafts for threads
// that need an answer. Deepak asked for times, so his draft offers free slots; Emma offered
// hers, so that draft just picks one.
const DEMO_SLOTS = suggestSlots({ availability: { days: [2, 3, 4], start: 10, end: 17, slotMin: 45, timeZone: 'America/New_York' } })
export const DEMO_EMAIL_DRAFTS = [
  {
    id: 'demo-d1', threadId: 'demo-t-anthropic', replyToMessageId: 'demo-e1', mailbox: ME, toAddress: 'deepak.nair@anthropic.com',
    subject: 'Re: Next round — final interviews', intent: 'schedule_call', status: 'pending', createdAt: hoursAgo(3),
    proposedSlots: DEMO_SLOTS, slotsChecked: true,
    body: `Hi Deepak,\n\nThat's great news, thank you! I'd be glad to do the final interviews. Here are a few times that work for me (Eastern):\n\n${DEMO_SLOTS.map(s => `• ${formatSlot(s, 'America/New_York')}`).join('\n')}\n\nHappy to adjust if none of those fit the team.\n\nBest,\nAlex`,
  },
  {
    id: 'demo-d2', threadId: 'demo-t-figma', replyToMessageId: 'demo-e3', mailbox: ME, toAddress: 'emma.whitfield@figma.com',
    subject: 'Re: Quick question about the PM internship', intent: 'confirm', status: 'pending', createdAt: hoursAgo(6),
    proposedSlots: [], slotsChecked: false,
    body: `Hi Emma,\n\nThank you so much, and thanks for the rotation doc! Thursday afternoon works great. I just grabbed a slot on your calendar and I'm looking forward to it.\n\nBest,\nAlex`,
  },
]
