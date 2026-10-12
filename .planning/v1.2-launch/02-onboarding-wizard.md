# 02 — Onboarding wizard

**Depends on:** 01 (`tracks`, `onboarded_at`).

## Problem

There's no first-run flow. `AuthGate` → `AppInner` drops a brand-new account on Today
(`App.jsx`, `useState('today')`). With no data, every list is empty, and Today renders
**"✓ Nothing needs your attention. You're on top of it."** (`TodayTab.jsx:638`). That's the wrong
message for someone who has done nothing yet. Profile, keys, Gmail, and Calendar setup all live
in Settings, which a new user has no reason to open.

## Change

### Gate

In `App.jsx`'s `AuthGate`: when `profile && !profile.onboarded_at`, render `<OnboardingWizard/>`
instead of `AppInner`. `/demo` is unaffected (it never goes through `AuthGate`).

### Component: `app/src/components/onboarding/OnboardingWizard.jsx` (+ one file per step)

Full-screen, same industrial design tokens as the rest of the app (no new palette). There's a step
rail on the left on desktop and a progress bar on mobile. Every step after step 1 has
**Skip for now**, and progress is saved per step, so closing the tab mid-wizard resumes at the
same step (`user_settings` key `onboarding_step`).

| Step | Collects | Writes | Required |
|---|---|---|---|
| 1. About you | name, school (datalist over `schools`, same matcher as `SettingsTab.jsx:245-247`), grad year, **tracks** (multi-select from `TRACKS`) | `profiles.full_name/school/school_id/grad_year/tracks` | yes (at least one track) |
| 2. AI key | paste an Anthropic key (or choose OpenAI), using the "Get a key" explainer from spec 04 | `POST /api/keys` (existing) | skippable → no-key mode |
| 3. Gmail | "Connect Gmail" via the existing `api/gmail.js` start flow, plus an **unverified-app explainer** (screenshot + "click Advanced → Go to recruitingos") | existing `gmail_tokens` | skippable |
| 4. Calendar | Connect Personal (existing `connectGoogleCalendar('personal')`), with the same explainer component | existing | skippable |
| 5. Seed | target companies (chips; for tech tracks, reuse the YC autocomplete from `CompanyOnboarding.jsx`; for other tracks, free text), plus an optional "add 1–3 people you already know" mini-form (calls `addContact`) | `rec_target_companies` (lsSet), `contacts` | skippable |
| 6. Done | summary of what's connected and what's off, then "Go to Today" | `profiles.onboarded_at = now()` | — |

Notes:
- Steps 3–4 leave the page for the OAuth redirect. The return URL has to resume the wizard: pass `?resume=onboarding` and have the step reader prefer it. Check the `api/gmail.js` callback's redirect target and add the param there instead of adding a route.
- The explainer is one shared component, `onboarding/UnverifiedAppNote.jsx`, which Settings also reuses next to its Connect buttons.
- If the user signed in with an API key (`@byok.local`), step 2 shows "✓ Key already added", and step 6 surfaces the existing "Secure your account" prompt.
- Settings gains a **"Re-run setup"** link that clears `onboarded_at`.

### Today empty state (lands in this spec because the wizard hands off to Today)

Replace the single `allEmpty` message (`TodayTab.jsx:624-638`) with a "getting started" checklist
when the account is new (no contacts, no apps, no interactions):
- Connect Gmail (hidden once connected)
- Add your first application
- Add a contact
- Add target companies → Grow

Keep "Nothing needs your attention" only for accounts that have data and nothing due.

## Tests / verification

- Unit: the step-resume reader (stored step plus `?resume` precedence).
- Manual, per sign-in path (email/password, Google, API key): fresh account → wizard → skip everything after step 1 → Today shows the getting-started checklist, not "you're on top of it".
- Manual: complete Gmail connect from step 3 and confirm you return to step 4, not Today.
- Render and screenshot the wizard at desktop and 390px width, and check it against the industrial direction (per global CLAUDE.md).

## Acceptance

No new account can reach `AppInner` without at least one track set, and no new account sees the
"you're on top of it" message.
