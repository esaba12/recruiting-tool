# 05 — Finance-aware AI prompts

**Depends on:** 01 (`tracksLabel`). The prompt text is what changes; the code paths stay the same.

## Problem

The multi-tenant Gmail pipeline prompt opens with **"You are processing a CS student's email"**
(`api/_lib/emailPipeline.js:184`). Its examples are tech-shaped ("Submit the HackerRank
assessment"), and its regex hints only know tech ATS vendors (`ATS_DOMAINS`, `:21`). Finance
recruiting emails look different: HireVue invites, superday invites, "diversity program" and
"insight week" sessions, coffee chats with analysts, and senders like Oracle Taleo or company
career sites. Today those get misclassified or under-staged.

## Change

### `api/_lib/emailPipeline.js` (Vercel, multi-tenant scan)
- The scan already runs per user. Load that user's `profiles.tracks` alongside the token (one more column in the existing select) and pass `tracksLabel` into the prompt: *"You are processing the email of a student recruiting for {SWE + IB} roles"*.
- Add stage-mapping guidance to the prompt:
  - HireVue / pre-recorded video interview / first-round → `INTERVIEW_INVITE`, stage `Phone Screen`
  - "Second round" / technicals → stage `Technical`
  - Superday / final round / assessment centre → stage `Onsite`
  - Online assessment / Pymetrics / numerical-reasoning test / HackerRank / CodeSignal → `OA_INVITE`
  - Insight / diversity / spring-week / info-session invites → networking (event), not an application
- Extend `ATS_DOMAINS` with finance-common vendors: `taleo.net`, `oraclecloud.com`, `successfactors.com`, `avature.net`, `hirevue.com`, `pymetrics.ai`, `brassring.com`, `jobvite.com`. Check each against real sender domains in a sample before adding. A false positive here costs only one Haiku call (the classifier is the real filter, per CLAUDE.md), but don't add domains you haven't confirmed.
- Add `superday|hirevue|first round|final round|assessment cent(re|er)` to the subject keyword hints.

### `scripts/email-pipeline.js` (owner's Apps Script, single-user)
Mirror only the ATS-domain and keyword additions; the owner is SWE. Push with `clasp` per
CLAUDE.md (`clasp clone` into a scratch dir and diff `appsscript.json` before pushing).

### Other prompts
- `lib/companyFinder.js` and `lib/drafting.js` are covered by spec 01's fan-out.
- `lib/learning/coach.js` already reads per-track template data, so no change.

## Tests / verification

- Unit: add a fixture-driven test for the prompt builder. Given `tracks=['ib']`, the prompt contains "IB" and the stage-mapping block. Given `['swe']`, it doesn't mention superday (keeps SWE prompts short).
- Unit: `guessCompanyHint`/ATS matcher accepts `careers.taleo.net` and similar senders.
- Manual (needs a BYOK key): run the classifier on 4–5 hand-written finance emails (HireVue invite, superday invite, rejection after superday, insight-week invite, analyst coffee-chat reply) and record the outputs in this file under a "Verification" heading.

## Acceptance

A superday invite lands as `INTERVIEW_INVITE`, stage `Onsite`. An insight-week invite does not
create an application.
