// Résumé text (v1.4 spec 09): pure helpers shared by the onboarding/Settings editor, client
// drafting (lib/drafting.js) and the server reply drafter (api/_lib/replyDraft.js).
// Only the text is stored (profiles.resume_text); the PDF itself is never uploaded.

export const RESUME_MAX_CHARS = 20000
// How much of the résumé goes into a drafting prompt. The top of a résumé (education,
// latest roles) is what a short email can draw on anyway.
export const RESUME_PROMPT_CHARS = 3000

const PAGE_NUMBER_RE = /^\s*(page\s+)?\d+(\s*(of|\/)\s*\d+)?\s*$/i

// PDF text comes out with ragged spacing, stray page numbers and runs of blank lines.
export function normalizeResumeText(raw) {
  const lines = String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .filter(l => !PAGE_NUMBER_RE.test(l))
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, RESUME_MAX_CHARS)
}

// The prompt block for drafting, or '' when there's no résumé.
export function resumePromptBlock(resumeText, max = RESUME_PROMPT_CHARS) {
  const text = String(resumeText || '').trim()
  if (!text) return ''
  const cut = text.length > max ? `${text.slice(0, max)}\n[…truncated]` : text
  return `\n\nCandidate background (from their résumé; use only facts stated here, never invent experience):\n"""\n${cut}\n"""`
}
