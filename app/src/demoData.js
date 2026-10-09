// Seed data for the public, no-sign-in /demo route (see db.js's isDemoMode() branch and
// App.jsx's DemoApp). Entirely fictional — a sample CS student's job search, not any real
// person's data — so this is safe to seed for anonymous portfolio visitors. Dates are
// computed relative to "today" (not hardcoded) so the demo always looks current whenever
// someone visits, rather than drifting stale.
//
// Shapes below intentionally match db.js's fetch* return shapes EXACTLY (camelCase, same
// keys) — the demo branch in db.js returns these arrays directly with zero mapping, so any
// component built against real data works unmodified against this data.

import { instantiateTemplate } from './lib/learning/templates.js'
import { PROBLEM_BY_SLUG } from './lib/learning/problemBank.js'

function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000).toISOString().split('T')[0]
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
]

export const DEMO_APPLICATIONS = [
  { id: 'demo-a1', company: 'Stripe', role: 'SWE Intern, Infrastructure', stage: 'Phone Screen', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-14), closedDate: null, lastActivity: daysFromNow(-2), daysInStage: 14, jdLink: 'https://stripe.com/jobs', notes: 'Recruiter screen scheduled via Kelly.', createdTime: daysFromNow(-20), referredById: null },
  { id: 'demo-a2', company: 'Anthropic', role: 'SWE Intern', stage: 'Technical', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-21), closedDate: null, lastActivity: daysFromNow(-1), daysInStage: 6, jdLink: 'https://anthropic.com/careers', notes: 'First technical round went well.', createdTime: daysFromNow(-25), referredById: null },
  { id: 'demo-a3', company: 'Figma', role: 'PM Intern', stage: 'Applied', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-6), closedDate: null, lastActivity: daysFromNow(-4), daysInStage: 6, jdLink: 'https://figma.com/careers', notes: '', createdTime: daysFromNow(-6), referredById: null, oaDueDate: null, oaLink: 'https://codesignal.com/test/figma-pm-intern', oaCompleted: false, oaResearchCheckedAt: daysFromNow(-1) },
  { id: 'demo-a4', company: 'Vercel', role: 'SWE Intern', stage: 'Applied', triage: 'Applied', location: 'Remote', sourceRepo: 'SimplifyJobs/Summer2027-Internships', appliedDate: daysFromNow(-18), closedDate: null, lastActivity: daysFromNow(-18), daysInStage: 18, jdLink: 'https://vercel.com/careers', notes: '', createdTime: daysFromNow(-18), referredById: null },
  { id: 'demo-a5', company: 'Ramp', role: 'SWE Intern', stage: 'Offer', triage: 'Applied', location: 'New York, NY', sourceRepo: '', appliedDate: daysFromNow(-40), closedDate: null, lastActivity: daysFromNow(-5), daysInStage: 5, jdLink: 'https://ramp.com/careers', notes: 'Offer received, deciding by end of month.', createdTime: daysFromNow(-45), referredById: 'demo-c5' },
  { id: 'demo-a6', company: 'Notion', role: 'SWE Intern', stage: 'Rejected', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-50), closedDate: daysFromNow(-10), lastActivity: daysFromNow(-10), daysInStage: 10, jdLink: '', notes: 'Didn\'t move past the first round.', createdTime: daysFromNow(-55), referredById: 'demo-c2' },
  { id: 'demo-a7', company: 'Airbnb', role: 'SWE Intern', stage: 'Wishlist', triage: 'Needs Review', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-1), daysInStage: null, jdLink: 'https://careers.airbnb.com', notes: '', createdTime: daysFromNow(-1), referredById: null },
  { id: 'demo-a8', company: 'Discord', role: 'SWE Intern', stage: 'Wishlist', triage: 'Needs Review', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-1), daysInStage: null, jdLink: 'https://discord.com/careers', notes: '', createdTime: daysFromNow(-1), referredById: null },
  { id: 'demo-a9', company: 'Rippling', role: 'SWE Intern', stage: 'Applied', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: daysFromNow(-3), closedDate: null, lastActivity: daysFromNow(-3), daysInStage: 3, jdLink: '', notes: '', createdTime: daysFromNow(-3), referredById: null, oaDueDate: daysFromNow(4), oaLink: 'https://hackerrank.com/test/rippling-swe-intern', oaCompleted: false, oaResearchCheckedAt: null },
  { id: 'demo-a10', company: 'Linear', role: 'SWE Intern', stage: 'Wishlist', triage: 'Maybe', location: 'Remote', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-2), daysInStage: null, jdLink: '', notes: 'Small team, not sure about internship structure yet.', createdTime: daysFromNow(-2), referredById: null },
  { id: 'demo-a11', company: 'Morgan Stanley', role: 'Investment Banking Summer Analyst', stage: 'Onsite', triage: 'Applied', location: 'New York, NY', sourceRepo: '', appliedDate: daysFromNow(-30), closedDate: null, lastActivity: daysFromNow(-3), daysInStage: 3, jdLink: 'https://example.com/careers', notes: 'Superday Friday — four back-to-back 30-min interviews (technicals + fit).', createdTime: daysFromNow(-35), referredById: 'demo-c8' },
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
]

// Inbox threads (see lib/inbox.js) — same rows the email pipeline writes: one per message,
// grouped by channelRef (the Gmail thread id). A mix of every inbox filter: an interview
// invite and a coffee-chat reply that need answers, a coding test, an offer, a rejection,
// an automated confirmation, and a sent cold email still waiting on a reply.
function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000).toISOString()
}
const ME = 'you@school.edu'
function demoEmail(id, thread, hrs, over) {
  const sentAt = hoursAgo(hrs)
  return {
    id, type: 'Email', channelRef: thread, date: sentAt.slice(0, 10), sentAt, mailbox: ME,
    direction: 'Inbound', readAt: null, summary: (over.body || '').slice(0, 300), ...over,
  }
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
  trackRow.config.leetcodeUsername = ''
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
