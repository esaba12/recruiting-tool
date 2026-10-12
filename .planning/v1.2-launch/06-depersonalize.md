# 06 — De-personalize leftovers

Small copy and fallback fixes, so a non-UMich user never sees the owner's school.

| Location | Today | Change |
|---|---|---|
| `components/LogInteractionModal.jsx:66` | `profile?.school ? \`${school} alum\` : 'UMich'` | fall back to `'Alum'` (or omit the tag) |
| `lib/discovery.js:148` | falls back to `'UMich'` when no university is set | same fallback as above |
| `lib/enrichment.js:165` | `draft.schoolTagLabel \|\| 'UMich alum'` | `draft.schoolTagLabel \|\| 'Alum'` |
| `lib/enrichment.js:168` | filters the literal `'UMich'` | filter by `schoolTagLabel` only |
| `api/_lib/emailPipeline.js:184` | "a CS student's email" | covered by spec 05 |
| DiscoverTab background-signals profile (`rec_affinity_profile`) | "seeded with UMich" per CLAUDE.md | seed from `profiles.school` |

**Not changed:** the `isUMichAlum` / `is_school_alum` field names. The DB column is already the
generic `is_school_alum`, and the JS name is internal. A rename across `db.js` and every caller is
churn with no user-visible effect. Leave a `// means "alum of the user's own school"` comment at
the `db.js` mapping.

## Verification

- `grep -rn "UMich\|Michigan" app/src --include='*.js' --include='*.jsx'` returns only comments, `demoData.js`, and the Localist adapter (UMich is real config there).
- Manual: an account with `school='Penn'` → Quick Add someone → the tag reads "Penn alum".
