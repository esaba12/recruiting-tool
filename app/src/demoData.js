// Seed data for the public, no-sign-in /demo route (see db.js's isDemoMode() branch and
// App.jsx's DemoApp). Entirely fictional — a sample CS student's job search, not any real
// person's data — so this is safe to seed for anonymous portfolio visitors. Dates are
// computed relative to "today" (not hardcoded) so the demo always looks current whenever
// someone visits, rather than drifting stale.
//
// Shapes below intentionally match db.js's fetch* return shapes EXACTLY (camelCase, same
// keys) — the demo branch in db.js returns these arrays directly with zero mapping, so any
// component built against real data works unmodified against this data.

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
    lastInteraction: daysFromNow(-1), followUpDate: daysFromNow(2), notes: 'Championing my app internally, said she\'d ping the hiring manager.',
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
]

export const DEMO_APPLICATIONS = [
  { id: 'demo-a1', company: 'Stripe', role: 'SWE Intern, Infrastructure', stage: 'Phone Screen', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-14), closedDate: null, lastActivity: daysFromNow(-2), daysInStage: 14, jdLink: 'https://stripe.com/jobs', notes: 'Recruiter screen scheduled via Priya.', createdTime: daysFromNow(-20), referredById: null },
  { id: 'demo-a2', company: 'Anthropic', role: 'SWE Intern', stage: 'Interview', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-21), closedDate: null, lastActivity: daysFromNow(-1), daysInStage: 6, jdLink: 'https://anthropic.com/careers', notes: 'First technical round went well.', createdTime: daysFromNow(-25), referredById: null },
  { id: 'demo-a3', company: 'Figma', role: 'PM Intern', stage: 'Applied', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-6), closedDate: null, lastActivity: daysFromNow(-4), daysInStage: 6, jdLink: 'https://figma.com/careers', notes: '', createdTime: daysFromNow(-6), referredById: null, oaDueDate: null, oaLink: 'https://codesignal.com/test/figma-pm-intern', oaCompleted: false, oaResearchCheckedAt: daysFromNow(-1) },
  { id: 'demo-a4', company: 'Vercel', role: 'SWE Intern', stage: 'Applied', triage: 'Applied', location: 'Remote', sourceRepo: 'SimplifyJobs/Summer2027-Internships', appliedDate: daysFromNow(-18), closedDate: null, lastActivity: daysFromNow(-18), daysInStage: 18, jdLink: 'https://vercel.com/careers', notes: '', createdTime: daysFromNow(-18), referredById: null },
  { id: 'demo-a5', company: 'Ramp', role: 'SWE Intern', stage: 'Offer', triage: 'Applied', location: 'New York, NY', sourceRepo: '', appliedDate: daysFromNow(-40), closedDate: null, lastActivity: daysFromNow(-5), daysInStage: 5, jdLink: 'https://ramp.com/careers', notes: 'Offer received, deciding by end of month.', createdTime: daysFromNow(-45), referredById: 'demo-c5' },
  { id: 'demo-a6', company: 'Notion', role: 'SWE Intern', stage: 'Rejected', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: '', appliedDate: daysFromNow(-50), closedDate: daysFromNow(-10), lastActivity: daysFromNow(-10), daysInStage: 10, jdLink: '', notes: 'Didn\'t move past the first round.', createdTime: daysFromNow(-55), referredById: 'demo-c2' },
  { id: 'demo-a7', company: 'Airbnb', role: 'SWE Intern', stage: 'Wishlist', triage: 'Needs Review', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-1), daysInStage: null, jdLink: 'https://careers.airbnb.com', notes: '', createdTime: daysFromNow(-1), referredById: null },
  { id: 'demo-a8', company: 'Discord', role: 'SWE Intern', stage: 'Wishlist', triage: 'Needs Review', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-1), daysInStage: null, jdLink: 'https://discord.com/careers', notes: '', createdTime: daysFromNow(-1), referredById: null },
  { id: 'demo-a9', company: 'Rippling', role: 'SWE Intern', stage: 'Applied', triage: 'Applied', location: 'San Francisco, CA', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: daysFromNow(-3), closedDate: null, lastActivity: daysFromNow(-3), daysInStage: 3, jdLink: '', notes: '', createdTime: daysFromNow(-3), referredById: null, oaDueDate: daysFromNow(4), oaLink: 'https://hackerrank.com/test/rippling-swe-intern', oaCompleted: false, oaResearchCheckedAt: null },
  { id: 'demo-a10', company: 'Linear', role: 'SWE Intern', stage: 'Wishlist', triage: 'Maybe', location: 'Remote', sourceRepo: 'speedyapply/2027-SWE-College-Jobs', appliedDate: null, closedDate: null, lastActivity: daysFromNow(-2), daysInStage: null, jdLink: '', notes: 'Small team, not sure about internship structure yet.', createdTime: daysFromNow(-2), referredById: null },
]

export const DEMO_INTERACTIONS = [
  { id: 'demo-i1', contactId: 'demo-c1', type: 'Email', direction: 'Inbound', date: daysFromNow(-2), channelRef: '', summary: 'Priya confirmed the recruiter screen is being scheduled.', body: '' },
  { id: 'demo-i2', contactId: 'demo-c4', type: 'Call', direction: 'Outbound', date: daysFromNow(-1), channelRef: '', summary: 'Great 20-min call — Sofia is championing my application internally.', body: '' },
  { id: 'demo-i3', contactId: 'demo-c2', type: 'Call', direction: 'Outbound', date: daysFromNow(-9), channelRef: '', summary: 'Marcus walked me through the infra team\'s interview loop and offered a referral.', body: '' },
  { id: 'demo-i4', contactId: 'demo-c3', type: 'LinkedIn', direction: 'Inbound', date: daysFromNow(-4), channelRef: '', summary: 'Emma sent over a doc on Figma\'s PM rotation program.', body: '' },
  { id: 'demo-i5', contactId: 'demo-c6', type: 'LinkedIn', direction: 'Outbound', date: daysFromNow(-11), channelRef: '', summary: 'Asked Amara a few questions about Vercel\'s interview process.', body: '' },
  { id: 'demo-i6', contactId: 'demo-c5', type: 'Meeting', direction: 'Outbound', date: daysFromNow(-32), channelRef: '', summary: 'Coffee chat with Malik about the Ramp platform team.', body: '' },
  { id: 'demo-i7', contactId: 'demo-c7', type: 'Meeting', direction: 'Outbound', date: daysFromNow(-60), channelRef: '', summary: 'Intro call through the alumni network.', body: '' },
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
    keyInsights: 'Team is growing fast; she\'ll flag my app to the hiring manager this week.',
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
