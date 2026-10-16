# 04 — Launch week: smoke test, invite, soft launch

**Blocked on:** 01 (demo) and 02 (SMTP, consent screen, cron). Carries forward
`.planning/v1.2-launch/08-ops-checklist.md` → P1.

## A. 🤖 Prod smoke test, three throwaway accounts

`enable_confirmations = false`, so new accounts need no email click. One account per sign-in path:

| Account | Path | Tracks | Must see |
|---|---|---|---|
| `smoke-pw-<date>@test.dev` | email + password | SWE | Wizard → Today's getting-started state; Job Boards in Pipeline; LeetCode widgets in Learn |
| a spare Google account | Continue with Google | IB | Wizard; **no** Job Boards, no YC-only Explore, no LeetCode widgets; Learn seeds the IB template |
| an Anthropic test key | Sign in with API key | Consulting | Wizard; "⚠ Secure your account" in Settings; AI buttons work |

For the first two, also check v1.2 DoD #3: with no AI key, Pipeline, Network, Calendar and manual
logging work with no error banners, and every AI button says why it's off.

Then: Feedback button → a row appears in `feedback`. Sentry got the test error (02 C2).

Clean up: delete all three users (Supabase → Auth → Users). User-owned rows cascade.

## B. Invite message (draft; edit to your voice)

> Hey! I built a recruiting tracker for my own internship search and I'm opening it up to a few
> friends: <prod link>. Takes about 3 minutes to set up.
>
> - It tracks applications, networking (who you've talked to, who's due a follow-up), events
>   and interview prep in one place, and it can read your recruiting emails so the pipeline
>   updates itself.
> - Want to look first? <prod link>/demo shows the whole thing with fake data, no sign-up.
> - If you sign in with Google you'll see "Google hasn't verified this app". That's because
>   it's a personal project, not a company. Click **Advanced → Go to recruitingos**. It only
>   asks for read-only email and calendar access, and only if you connect them.
> - The AI features (auto-fill, email reading, drafting) use your own Anthropic or OpenAI key.
>   The app walks you through getting one, and normal use costs a few cents a week. Everything
>   else works without a key.
> - There's a **Feedback** button bottom-left. Please use it for anything broken or confusing.

## C. Soft launch

- [ ] Send to 3–5 friends, at least one in finance or consulting and at least one outside UMich (they'll have no campus, so Events is off for them; that's expected).
- [ ] After 48h: `select * from feedback order by created_at desc`, Sentry issues, and Supabase
      → Auth → Users (did everyone finish onboarding? `profiles.onboarded_at is not null`).
- [ ] Fix anything P0, then send to the wider group.

## Done when

A passes and is cleaned up, and C's 48h review is done.
