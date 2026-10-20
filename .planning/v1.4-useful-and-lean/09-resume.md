# 09 — Résumé in onboarding

**Who:** 🤖. **Migration:** yes, shared with [10](10-reply-drafts.md) (`20261020000000_resume_and_email_drafts.sql`). **Depends on:** nothing.

## Why

Every draft the app writes (cold opens, and now [10](10-reply-drafts.md)'s replies) guesses at
who the student is from a school and a track. A résumé is the one document every student
already has, and it turns "I'm a CS student" into "I built the billing pipeline at Acme".

## Decisions (owner, 2026-10-20)

- Upload a PDF and **keep only the text** (`profiles.resume_text`). There's no file storage,
  so there's no bucket to secure. Pasting text works too.

## Changes

1. **Migration:** `profiles.resume_text text`, `profiles.resume_updated_at timestamptz`. The
   existing "profiles: update own" policy covers writes.
2. **`lib/resume.js`** (pure, shared with the server): `normalizeResumeText` (spacing, page
   numbers, 20k cap) and `resumePromptBlock` (up to 3k chars plus a "never invent experience" rule).
3. **`lib/resumePdf.js`:** `pdfjs-dist@6.3.289`, lazy-loaded (its own chunk plus a same-origin
   worker, which the CSP allows), `isEvalSupported: false` (no `unsafe-eval` in the CSP),
   first 5 pages.
4. **`ResumeEditor`** (`components/onboarding/`): a drop zone or file picker, then editable
   text. Shared by the wizard and Settings.
5. **Wizard:** a new `resume` step right after About you, skippable (`STEP_IDS`). The Ready
   screen shows Résumé added or not added.
6. **Settings → Résumé:** save, replace, remove (`db.js` `saveResumeText`, with a demo branch).
7. **Drafting:** `buildDraftPrompt` cold opens include the résumé block, but not for personal
   contacts (same rule as the persona clause) and not for follow-up nudges.

## Tests

`test/resume.test.js`, `test/drafting.test.js` (résumé block gated), `test/onboarding.test.js`
(step order and resume), `test/rls.test.js` (résumé owner-only).

## Verified

- A Chrome-generated résumé PDF goes through `extractResumeText` under the dev server and
  comes out clean, line by line.
- `npm run build`: pdf.js is in its own lazy chunk.
- Migration pushed 2026-10-20 (owner approved). The live RLS suite passes 14/14.
- Wizard on a throwaway account (local dev against the hosted project, deleted afterwards):
  upload the PDF, the text appears, Continue saves `resume_text` + `resume_updated_at`, and Ready shows Résumé ON.
