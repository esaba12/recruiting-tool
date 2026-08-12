import { aiJSON, AI_MODELS } from './ai.js'
import { ROLE_OPTIONS, STATUS_OPTIONS, REFERRAL_STATUS_OPTIONS, STAGE_ORDER } from '../shared.jsx'
import { TRIAGE_TO_BUCKET } from '../components/jobBoards/helpers.js'
import { normalizeCompanyName } from './networkGraph.js'
import { importApplicationFromUrl } from './applicationImport.js'

export const TYPE_OPTIONS = ['Call', 'LinkedIn', 'Meeting', 'Email', 'Other']
export const TRIAGE_OPTIONS = Object.keys(TRIAGE_TO_BUCKET)
export const ACTIONS = ['add_application', 'update_application', 'add_target_company', 'log_interaction', 'update_contact', 'unclear']

const URL_RE = /https?:\/\/[^\s]+/i
// Profile/social links pasted alongside a name are almost always about the *person*
// ("check out linkedin.com/in/x"), not a posting to apply to — everything else (a
// Greenhouse/Lever/company careers link, etc.) is treated as a job application.
const PROFILE_LINK_HOSTS = ['linkedin.com', 'twitter.com', 'x.com', 'github.com']

function extractUrl(text) {
  const m = text.match(URL_RE)
  if (!m) return null
  const url = m[0].replace(/[),.]+$/, '') // strip trailing punctuation the user typed after the link
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (PROFILE_LINK_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) return null
    return url
  } catch {
    return null
  }
}

// "bytedance, spacex, and tiktok" -> ["bytedance", "spacex", "tiktok"] — splits a
// comma/and/&-joined company list back into individual names, so "apply to X, Y, and Z"
// becomes N separate Pipeline rows instead of one row with a mangled company field.
function splitCompanies(raw) {
  if (!raw) return []
  return raw
    .split(/,|\/|;|(?:\s+and\s+)|(?:\s+&\s+)/i)
    .map(s => s.trim())
    .filter(Boolean)
}

// A pasted job-posting link is a distinct intent from a note about a person — route it
// straight to the existing paste-a-link application importer instead of round-tripping
// through the AI router below (the URL alone is enough signal, and reading the real page
// gives a much better company/role/location guess than the model could make from the link
// text alone).
async function parseApplicationLink(text, url) {
  try {
    const result = await importApplicationFromUrl(url)
    return {
      action: 'add_application',
      jdLink: url,
      company: result.company || '',
      role: result.role || '',
      location: result.location || '',
      importNote: result.company ? '' : "Couldn't auto-read that page — fill in the details below.",
      rawText: text,
    }
  } catch (e) {
    return {
      action: 'add_application',
      jdLink: url,
      company: '',
      role: '',
      location: '',
      importNote: e.message || "Couldn't auto-read that page — fill in the details below.",
      rawText: text,
    }
  }
}

// Ranks existing contacts against a free-text name guess — exact match first, then
// substring, then first/last-name token overlap. Used both to seed the AI prompt's
// candidate list and to pick a sane default selection client-side (never trust the
// model's matched_contact_id without cross-checking it against real contacts, since
// it could hallucinate an id that isn't in the list). Returns { contact, score } pairs
// so callers can both render the candidates and threshold on confidence.
export function bestContactMatches(nameGuess, contacts, limit = 6) {
  const q = (nameGuess || '').trim().toLowerCase()
  if (!q || !contacts?.length) return []
  const qTokens = q.split(/\s+/).filter(Boolean)
  return contacts
    .map(contact => {
      const cName = (contact.name || '').toLowerCase()
      let score = 0
      if (cName === q) score = 100
      else if (cName.includes(q) || q.includes(cName)) score = 60
      else {
        const cTokens = cName.split(/\s+/).filter(Boolean)
        score = qTokens.filter(t => cTokens.includes(t)).length * 20
      }
      return { contact, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// Same idea as bestContactMatches but for applications — matched on company name (the
// thing people actually say, "mark stripe as...") with role text as a tiebreaker.
export function bestApplicationMatches(query, apps, limit = 6) {
  const q = normalizeCompanyName(query || '')
  if (!q || !apps?.length) return []
  return apps
    .map(app => {
      const cName = normalizeCompanyName(app.company || '')
      let score = 0
      if (cName === q) score = 100
      else if (cName.includes(q) || q.includes(cName)) score = 60
      return { app, score }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function buildPrompt(text, contacts, apps) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const contactList = contacts.slice(0, 500)
    .map(c => `${c.id}::${c.name}${c.company ? ` @ ${c.company}` : ''}`)
    .join('\n')
  const openApps = apps.filter(a => !['Rejected', 'Accepted'].includes(a.stage)).slice(0, 300)
  const appList = openApps
    .map(a => `${a.id}::${a.company}${a.role ? ` — ${a.role}` : ''} (stage: ${a.stage}, triage: ${a.triage})`)
    .join('\n')

  return `Today is ${today}. You are the intake router for a recruiting CRM's "quick capture" box — a free-text field the user fires off like a text to themselves, covering ANYTHING they might want the CRM to do: log a note about someone in their network, add or update a job application, or add a company to their target list. Figure out what CRM action this implies and return ONLY valid JSON, no explanation, no markdown fences.

Existing contacts (id::name @ company) — match against these for anything about a person. Only set matched_contact_id to an id copied EXACTLY as it appears here, or null if there's no confident match:
${contactList || '(no contacts yet)'}

Existing open applications (id::company — role (stage, triage)) — match against these for anything about a job/application already being tracked. Only set matched_application_id to an id copied EXACTLY as it appears here, or null if there's no confident match:
${appList || '(no open applications yet)'}

Return JSON in exactly this shape:
{
  "action": "add_application" | "update_application" | "add_target_company" | "log_interaction" | "update_contact" | "unclear",

  "contact_name": "the person's name as best you can tell, or null — only for log_interaction/update_contact",
  "matched_contact_id": "an id copied exactly from the contacts list above, or null",
  "role_guess": "one of ${ROLE_OPTIONS.join('|')} — this PERSON's relationship to the user, best guess, or null",
  "interaction_type": "one of ${TYPE_OPTIONS.join('|')} — what kind of touchpoint this implies, default Other if it's clearly a touchpoint but the channel is unclear, or null if action is not log_interaction",
  "summary": "one plain sentence restating what happened, to log as the interaction summary, or null",
  "referral_status": "one of ${REFERRAL_STATUS_OPTIONS.join('|')} — ONLY if the note clearly signals a referral commitment (e.g. 'said they'd refer me', 'agreed to refer', 'declined to refer'), else null",
  "status_bump": "one of ${STATUS_OPTIONS.join('|')} — ONLY if the note clearly signals the relationship just got warmer or colder, else null",
  "notes_append": "a short note about the PERSON capturing anything not already covered above worth remembering, or null",

  "company": "a company name — the hiring company for add_application/update_application/add_target_company, or the person's employer for log_interaction/update_contact, or null",
  "role": "the job title text, only for add_application (e.g. 'Software Engineer Intern'), or null",
  "location": "city/region for add_application if stated, else null",
  "matched_application_id": "an id copied exactly from the applications list above, or null — for update_application",
  "stage": "one of ${STAGE_ORDER.join('|')} — ONLY for update_application, ONLY if the note clearly signals the application moved to a new interview stage, else null",
  "triage": "one of ${TRIAGE_OPTIONS.join('|')} — ONLY for update_application, ONLY if the note clearly signals a triage decision (e.g. 'pass on it', 'gonna apply', 'not sure about this one'), else null",
  "application_notes_append": "a short note about the APPLICATION worth remembering, or null",

  "clarifying_question": "if you genuinely can't tell what CRM action this implies, a short question to ask the user, else null"
}

Rules:
- action is "unclear" ONLY when there's no identifiable person, company, or usable context at all — always try your best guess first rather than defaulting to unclear.
- action is "add_application" when the note describes a NEW job/internship to track that isn't already in the open applications list above (e.g. "add the spacex swe intern role", "wanna apply to notion's PM internship"). If the note names MULTIPLE companies for the same role (e.g. "need to apply to bytedance, spacex, and tiktok swe"), put every company name in "company" separated by commas — never merge them into one name — and put the shared role in "role".
- action is "update_application" when the note refers to a job ALREADY in the open applications list above — a stage change, a pass/apply decision, or any other update to that application.
- action is "add_target_company" when the note is purely about wanting to target/pursue a company for future opportunities, with no specific role mentioned (e.g. "add anthropic to my target list", "I want to work at duolingo").
- action is "update_contact" when the note is purely a status/field update about a person with no real touchpoint to log (e.g. "mark sarah as closed").
- action is "log_interaction" for anything describing an actual interaction, conversation, or thing someone said/did — this covers most people-notes, including referral signals (referral_status can be set alongside log_interaction).
- Never invent a company, role, stage, or referral signal that isn't stated or strongly implied by the note.
- If the note could plausibly be about either a person or a company/application and it's genuinely ambiguous, prefer whichever is more clearly identifiable (a matched contact vs. a matched/named company).

User's note: "${text}"`
}

// Parses one free-text quick-capture note into a structured CRM action — routes to
// whichever of add_application / update_application / add_target_company /
// log_interaction / update_contact the note implies. Never writes anything itself —
// callers render the result as an editable draft and only hit the database once the
// user explicitly confirms (same shape as enrichContact()).
export async function parseQuickCapture(text, contacts, apps = []) {
  const jobUrl = extractUrl(text)
  if (jobUrl) return parseApplicationLink(text, jobUrl)

  const raw = await aiJSON({ model: AI_MODELS.STANDARD, content: buildPrompt(text, contacts, apps), maxTokens: 600 })
  const action = ACTIONS.includes(raw.action) ? raw.action : 'unclear'

  if (action === 'add_application') {
    const companies = splitCompanies(raw.company)
    if (companies.length > 1) {
      return {
        action: 'add_application_multi',
        drafts: companies.map(company => ({
          company, role: raw.role || '', location: raw.location || '', jdLink: '',
          importNote: '', resolving: true, status: 'pending',
        })),
        rawText: text,
      }
    }
    return {
      action,
      company: raw.company || '',
      role: raw.role || '',
      location: raw.location || '',
      jdLink: '',
      importNote: '',
      rawText: text,
    }
  }

  if (action === 'update_application') {
    const matchedAppId = raw.matched_application_id && apps.some(a => a.id === raw.matched_application_id)
      ? raw.matched_application_id
      : null
    const fallbackApp = !matchedAppId ? bestApplicationMatches(raw.company, apps, 1)[0] : null
    const resolvedApplicationId = matchedAppId || (fallbackApp?.score >= 60 ? fallbackApp.app.id : '') || ''
    return {
      action,
      applicationQuery: raw.company || '',
      resolvedApplicationId,
      stage: STAGE_ORDER.includes(raw.stage) ? raw.stage : '',
      triage: TRIAGE_OPTIONS.includes(raw.triage) ? raw.triage : '',
      notesAppend: raw.application_notes_append || '',
      clarifyingQuestion: raw.clarifying_question || '',
      rawText: text,
    }
  }

  if (action === 'add_target_company') {
    return {
      action,
      company: raw.company || '',
      rawText: text,
    }
  }

  if (action === 'unclear') {
    return { action, clarifyingQuestion: raw.clarifying_question || "I couldn't tell what to do with that — try adding more detail.", rawText: text }
  }

  // log_interaction / update_contact — same shape as before.
  const matchedId = raw.matched_contact_id && contacts.some(c => c.id === raw.matched_contact_id)
    ? raw.matched_contact_id
    : null
  const fallbackMatch = !matchedId ? bestContactMatches(raw.contact_name, contacts, 1)[0] : null
  const defaultContactId = matchedId || (fallbackMatch?.score >= 60 ? fallbackMatch.contact.id : '') || ''

  return {
    action,
    contactName: raw.contact_name || '',
    resolvedContactId: defaultContactId,
    company: raw.company || '',
    roleGuess: ROLE_OPTIONS.includes(raw.role_guess) ? raw.role_guess : 'Other',
    interactionType: action === 'log_interaction'
      ? (TYPE_OPTIONS.includes(raw.interaction_type) ? raw.interaction_type : 'Other')
      : '',
    summary: raw.summary || '',
    referralStatus: REFERRAL_STATUS_OPTIONS.includes(raw.referral_status) ? raw.referral_status : '',
    statusBump: STATUS_OPTIONS.includes(raw.status_bump) ? raw.status_bump : '',
    notesAppend: raw.notes_append || '',
    clarifyingQuestion: raw.clarifying_question || '',
    rawText: text,
  }
}
