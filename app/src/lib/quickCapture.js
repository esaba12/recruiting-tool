import { aiJSON, AI_MODELS } from './ai.js'
import { ROLE_OPTIONS, STATUS_OPTIONS, REFERRAL_STATUS_OPTIONS } from '../shared.jsx'

export const TYPE_OPTIONS = ['Call', 'LinkedIn', 'Meeting', 'Email', 'Other']

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

function buildPrompt(text, contacts) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const contactList = contacts.slice(0, 500)
    .map(c => `${c.id}::${c.name}${c.company ? ` @ ${c.company}` : ''}`)
    .join('\n')

  return `Today is ${today}. You are the intake parser for a recruiting CRM's "quick capture" box — a free-text field where the user jots a quick note about someone in their network, the way they'd text a friend. Figure out what CRM action this implies and return ONLY valid JSON, no explanation, no markdown fences.

Existing contacts (id::name @ company) — match the note against these if it refers to someone already tracked. Only set matched_contact_id to an id copied EXACTLY as it appears here, or null if there's no confident match:
${contactList || '(no contacts yet)'}

Return JSON in exactly this shape:
{
  "action": "log_interaction" | "update_contact" | "unclear",
  "contact_name": "the person's name as best you can tell, or null",
  "matched_contact_id": "an id copied exactly from the list above, or null",
  "confidence": "high" | "medium" | "low",
  "company": "their company if mentioned or clearly inferable, else null",
  "role_guess": "one of ${ROLE_OPTIONS.join('|')} — best guess, or null",
  "interaction_type": "one of ${TYPE_OPTIONS.join('|')} — what kind of touchpoint this implies, default Other if it's clearly a touchpoint but the channel is unclear, or null if action is not log_interaction",
  "summary": "one plain sentence restating what happened, to log as the interaction summary, or null",
  "referral_status": "one of ${REFERRAL_STATUS_OPTIONS.join('|')} — ONLY if the note clearly signals a referral commitment (e.g. 'said they'd refer me', 'agreed to refer', 'declined to refer'), else null",
  "status_bump": "one of ${STATUS_OPTIONS.join('|')} — ONLY if the note clearly signals the relationship just got warmer or colder, else null",
  "notes_append": "a short note capturing anything not already covered above worth remembering, or null",
  "clarifying_question": "if you genuinely can't tell who this is about or what to log, a short question to ask the user, else null"
}

Rules:
- action is "unclear" ONLY when there's no identifiable person and no usable context at all — always try your best guess first rather than defaulting to unclear.
- action is "update_contact" when the note is purely a status/field update with no real touchpoint to log (e.g. "mark sarah as closed").
- action is "log_interaction" for anything describing an actual interaction, conversation, or thing someone said/did — this covers most notes, including referral signals (referral_status can be set alongside log_interaction).
- Never invent a company, role, or referral signal that isn't stated or strongly implied by the note.
- confidence reflects how sure you are about WHO this note is about, not about the CRM fields.

User's note: "${text}"`
}

// Parses one free-text quick-capture note into a structured CRM action. Never writes
// anything itself — callers render the result as an editable draft and only hit the
// database once the user explicitly confirms (same shape as enrichContact()).
export async function parseQuickCapture(text, contacts) {
  const raw = await aiJSON({ model: AI_MODELS.STANDARD, content: buildPrompt(text, contacts), maxTokens: 500 })

  // Cross-check the model's contact match against the real list — a hallucinated id
  // would otherwise silently write to (or 404 against) the wrong/nonexistent contact.
  const matchedId = raw.matched_contact_id && contacts.some(c => c.id === raw.matched_contact_id)
    ? raw.matched_contact_id
    : null

  const fallbackMatch = !matchedId ? bestContactMatches(raw.contact_name, contacts, 1)[0] : null
  const defaultContactId = matchedId || (fallbackMatch?.score >= 60 ? fallbackMatch.contact.id : '') || ''

  const action = ['log_interaction', 'update_contact', 'unclear'].includes(raw.action) ? raw.action : 'unclear'

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
