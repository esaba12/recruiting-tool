# Phase 4: Shared Record Side-Panel - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 10 files (4 new components, 6 modified call sites)
**Analogs found:** 8 / 10 (all new components have direct analogs; call sites reference existing patterns)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/SidePanel.jsx` | component (UI primitive) | request-response | `ui/Modal.jsx` | exact |
| `panels/ContactPanelBody.jsx` | component (form/edit) | CRUD | `ContactDetailModal.jsx` | source |
| `panels/ApplicationPanelBody.jsx` | component (form/edit) | CRUD | `ApplicationDetailModal.jsx` | source |
| `panels/JobPanelBody.jsx` | component (view/triage) | request-response | `jobBoards/JobDetailModal.jsx` | source |
| `App.jsx` (NetworkTab) | component (layout) | request-response | `App.jsx` (existing NetworkTab) | exact |
| `TodayTab.jsx` | component (layout) | request-response | `TodayTab.jsx` (existing) | exact |
| `CalendarTab.jsx` | component (layout) | request-response | `CalendarTab.jsx` (existing) | exact |
| `ReferralCoverageTab.jsx` | component (layout) | request-response | `ReferralCoverageTab.jsx` (existing) | exact |
| `PipelineTab.jsx` | component (layout) | request-response | `PipelineTab.jsx` (existing) | exact |
| `jobBoards/RepoJobsView.jsx` | component (layout) | request-response | `jobBoards/RepoJobsView.jsx` (existing) | exact |

---

## Pattern Assignments

### `ui/SidePanel.jsx` (component, request-response)

**Analog:** `app/src/components/ui/Modal.jsx` (lines 1-44)

**Purpose:** Shared shell primitive for all record-type panel bodies. Replaces 3 hand-copied overlay implementations with one reusable component. Desktop: slide-in from right edge with backdrop. Mobile: bottom-sheet (slide-up from bottom, matching existing modal convention).

**Imports pattern** (lines 1-3 of Modal.jsx):
```jsx
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn.js'
```

**Escape-key + click-outside-to-close logic** (lines 12-17 of Modal.jsx):
```jsx
useEffect(() => {
  if (!onClose) return
  function onKeyDown(e) { if (e.key === 'Escape') onClose() }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [onClose])
```

**AnimatePresence with exit animation** (lines 20-42 of Modal.jsx):
```jsx
return (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 bg-ink-900/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
        onClick={e => e.target === e.currentTarget && onClose?.()}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          className={cn(
            'bg-white w-full rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto',
            SIZES[size], className,
          )}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
)
```

**Implementation Note on Desktop/Mobile Transform Difference:**
SidePanel must differ from Modal.jsx by using responsive transforms:
- **Desktop (md:)**: `translateX(-100%)` → `translateX(0)` (slide in from right)
- **Mobile**: existing `translateY(100%)` → `translateY(0)` (slide up from bottom)

See RESEARCH.md Assumption A1 — the responsive dual-axis animation requires either:
1. A `useMediaQuery` hook driving which transform object is passed (recommended)
2. CSS-only positioning with a single `opacity` framer-motion animation axis

Both approaches are valid; this pattern documents the Modal.jsx baseline that SidePanel extends.

---

### `panels/ContactPanelBody.jsx` (component, CRUD)

**Analog:** `app/src/components/ContactDetailModal.jsx` (full file, 376 lines)

**Purpose:** Ported form body from ContactDetailModal, handling create (isNew) and edit modes with bidirectional affinity/UMichAlum sync, relationships management, and embedded LogInteractionModal/DraftPanel.

**Key patterns to preserve (PANEL-02 zero-regression requirement):**

1. **isNew branch logic** (lines 14, 112-113, 180):
   - `isNew = !contact` determines if this is a creation form
   - Save path differs: `addContact()` for new vs. `updateContact()` for edit
   - Button text: "+ Add Contact" vs. "Save Changes"
   - Displayed fields differ: new form omits Status/Urgency/Referred By/Follow-Up Date sections

2. **State initialization pattern** (lines 15-35):
```jsx
const [form, setForm] = useState(() => ({
  name:        contact?.name || initial.name || '',
  company:     contact?.company || initial.company || '',
  role:        contact?.role || '',
  email:       contact?.email || '',
  linkedin:    contact?.linkedin || '',
  source:      contact?.source || '',
  status:      contact?.status || '🟡 Cooling',
  urgency:     contact?.urgency || 'LOW',
  referredById: contact?.referredById || '',
  referralStatus: contact?.referralStatus || 'Not Asked',
  whatTheyDid: contact?.whatTheyDid || '',
  notes:       contact?.notes || '',
  followUpDate: contact?.followUpDate ? contact.followUpDate.slice(0, 10) : '',
  isUMichAlum: contact?.isUMichAlum || false,
  affinity:    contact?.affinity || [],
  lifeDomain:  contact?.lifeDomain || [],
  wantsToSchedule: contact?.wantsToSchedule || false,
  scheduleBy:      contact?.scheduleBy ? contact.scheduleBy.slice(0, 10) : '',
  scheduleNote:    contact?.scheduleNote || '',
}))
```

3. **Bidirectional affinity/UMichAlum sync** (lines 51-62):
```jsx
function toggleUMichAlum() {
  setForm(f => {
    const next = !f.isUMichAlum
    return { ...f, isUMichAlum: next, affinity: next ? [...new Set([...f.affinity, schoolLabel])] : f.affinity.filter(a => a !== schoolLabel) }
  })
}
function toggleAffinity(tag) {
  setForm(f => {
    const has = f.affinity.includes(tag)
    const affinity = has ? f.affinity.filter(a => a !== tag) : [...f.affinity, tag]
    return { ...f, affinity, isUMichAlum: tag === schoolLabel ? !has : f.isUMichAlum }
  })
}
```

4. **Save handler pattern** (lines 108-129):
```jsx
async function save() {
  if (!form.name.trim()) { setError('Name is required'); return }
  setSaving(true); setError(null)
  try {
    if (isNew) {
      await addContact({ name: form.name, company: form.company, role: form.role, email: form.email })
    } else {
      await updateContact(contact.id, {
        name: form.name, company: form.company, role: form.role || null, email: form.email,
        linkedin: form.linkedin, source: form.source || null, status: form.status, urgency: form.urgency,
        referredById: form.referredById || null, referralStatus: form.referralStatus, whatTheyDid: form.whatTheyDid, notes: form.notes,
        followUpDate: form.followUpDate || null,
        isUMichAlum: form.isUMichAlum, affinity: form.affinity, lifeDomain: form.lifeDomain,
        wantsToSchedule: form.wantsToSchedule, scheduleBy: form.scheduleBy || null, scheduleNote: form.scheduleNote,
      })
    }
    onSaved()
  } catch (e) {
    setError(e.message)
    setSaving(false)
  }
}
```

5. **Relationships section** (lines 78-106):
   - Only rendered when `!isNew`
   - Reuses data from props: `contactRelationships`, `contacts` for lookup
   - Includes add/remove handlers that call `addContactRelationship()` / `deleteContactRelationship()` and trigger `onRefreshRelationships` (not `onSaved` — this keeps the modal open for batch editing)

6. **Interaction history panel** (rendered from `interactions` filtered by `contact.id`)

7. **Embedded modals** (lines 8-9, 39-40):
   - `LogInteractionModal` opened via `setLogOpen`
   - `DraftPanel` opened via `setDraftOpen` for follow-up drafts
   - Both render *inside* the same modal, not nested as separate overlays

**Props required by ContactPanelBody:**
```jsx
{
  contact,                    // null (isNew) or existing contact object
  contacts,                   // full array for Referred By / Relationships dropdowns
  interactions,               // array filtered to contact.id for history panel
  contactRelationships = [],  // array of relationship objects for this contact
  onClose,                    // () => void
  onSaved,                    // () => void, closes the panel and refreshes parent
  onRefreshRelationships,     // () => Promise, re-fetches relationships without closing
  initial = {},               // seed values for isNew form (e.g., { name: 'Jane Doe' })
  onOpenContact,              // (id) => void, called when a referrer is clicked — triggers D-05 in-place swap (NEW for this phase)
}
```

---

### `panels/ApplicationPanelBody.jsx` (component, CRUD)

**Analog:** `app/src/components/ApplicationDetailModal.jsx`

**Purpose:** Ported form body from ApplicationDetailModal. Handles create (isNew) and edit modes. Includes embedded `NetworkAtCompany` dossier panel for existing applications, AI fit analysis, and supports nested `ContactDetailModal` opening (which becomes D-05's in-place swap in SidePanel host).

**Key patterns to preserve:**

1. **isNew branch logic** (detected by `!app`):
   - New application form: company/role/location/jdLink only
   - Includes paste-URL auto-import flow (`importApplicationFromUrl()`)
   - Includes duplicate-detection warning (`appDuplicateKey()`)
   - Existing application form: adds Stage/dates/triage/warm-path fields
   - Button: "+ Add Application" vs. "Save Changes"

2. **Stage change auto-fill pattern** (lines 133-138 in ApplicationDetailModal.jsx):
```jsx
function changeStage(stage) {
  setDates(d => ({
    ...d, stage,
    closedDate: TERMINAL_STAGES.includes(stage) ? (d.closedDate || new Date().toISOString().split('T')[0]) : '',
  }))
}
```
This sync must be preserved exactly — moving to a terminal stage auto-fills Closed Date with today if not already set; moving back out clears it.

3. **NetworkAtCompany dossier sub-panel** (lines 36-98 in ApplicationDetailModal.jsx):
   - Rendered only for existing applications
   - Has internal `onOpenContact` handler that currently opens a nested `ContactDetailModal`
   - This handler must be re-wired to call `onOpenContact` (for D-05 stack-based swap) instead

4. **AI Fit Analysis** (sub-section with loading/error states and `generateJobAnalysis()` call)

5. **Save handler pattern** (similar to Contact, but with `updateApplication()` for edit path)

**Props required by ApplicationPanelBody:**
```jsx
{
  app,                            // null (isNew) or existing application object
  contacts = [],                  // for Referred By dropdown + NetworkAtCompany
  apps = [],                      // for duplicate detection (isNew) + stage comparisons
  interactions = [],              // for NetworkAtCompany warm-paths
  relationships = [],             // for NetworkAtCompany warm-paths
  onStatusChange,                 // (bucketKey) => void, called by triage bucket UI
  onClose,                        // () => void
  onDelete,                       // () => void
  onSaved,                        // () => void
  onFindPeople,                   // (company) => void, called by NetworkAtCompany's "Find more" button
  onRefresh,                      // () => Promise, re-fetches just this application
  onRefreshRelationships,         // () => Promise, re-fetches relationships
  onOpenContact,                  // (id) => void, called when NetworkAtCompany contact row is clicked — triggers D-05 swap (NEW for this phase)
}
```

**Important:** The `NetworkAtCompany` component (lines 36-98) must have its internal `onOpenContact={setOpenContactId}` call re-wired to `onOpenContact?.(id)` (passed from parent). This is the concrete trigger for D-05's in-place stack swap.

---

### `panels/JobPanelBody.jsx` (component, request-response)

**Analog:** `app/src/components/jobBoards/JobDetailModal.jsx` (195 lines)

**Purpose:** Ported view/triage-only panel from JobDetailModal. No creation mode (jobs only enter system via board import). Supports triage bucket changes, AI fit analysis on-demand, and deadline re-check.

**Key patterns to preserve:**

1. **View-only with triage state change** (no isNew mode):
   - All fields are read-only display
   - Only interactive element: `onStatusChange(bucketKey)` button handlers for triage buckets
   - No save/delete actions on the job itself

2. **Deadline display and re-check** (lines 6-26 in JobDetailModal.jsx):
```jsx
const ageDays = jobAgeDays(job)
const stale = isGhostJob(job)
const tier = urgencyTier(deadline)
const deadlineDays = daysUntilDeadline(deadline)

async function doAnalysis() {
  setAiLoading(true); setAiError(null)
  try { setAnalysis(await generateJobAnalysis(job, prefs)) }
  catch (e) { setAiError(e.message) }
  finally { setAiLoading(false) }
}
```

3. **Deadline badge styling** (DEADLINE_TEXT object):
```jsx
const DEADLINE_TEXT = {
  urgent: 'text-danger-600 bg-danger-50',
  soon:   'text-warning-700 bg-warning-100',
  known:  'text-ink-600 bg-ink-100',
}
```

**Props required by JobPanelBody:**
```jsx
{
  job,                  // job object (never null, no create mode)
  status,               // current triage bucket (from parent state)
  blurb,                // AI-extracted company/role summary
  deadline,             // deadline extraction data
  onRecheckDeadline,    // () => Promise, re-runs deadline extraction
  onStatusChange,       // (bucketKey) => void, called by triage buttons
  onClose,              // () => void
  prefs,                // user's job preferences for AI fit analysis
}
```

---

## Call-Site Migrations (6 modified files)

All of the following currently render one or more of the 3 modals directly. They must be re-pointed to render `SidePanel` + the matching body component instead. **Exact prop shapes must be preserved per Pitfall 4 in RESEARCH.md** — if a call site omits a prop today, carry that omission forward (e.g., `CalendarTab.jsx` omits `contactRelationships` and `onRefreshRelationships` from its `ContactDetailModal` call; this should remain omitted in the new `ContactPanelBody` call to avoid changing behavior unexpectedly).

### `App.jsx` — NetworkTab rendering

**Analog:** `App.jsx` (existing NetworkTab component, lines showing contact selection state)

**Current pattern (to be replaced):**
```jsx
{selectedContactId && (
  <ContactDetailModal
    contact={contacts.find(c => c.id === selectedContactId)}
    contacts={contacts}
    interactions={interactions}
    contactRelationships={relationships}
    onClose={() => setSelectedContactId(null)}
    onSaved={() => { setSelectedContactId(null); onRefresh?.() }}
    onRefreshRelationships={onRefreshRelationships}
  />
)}
```

**New pattern (post-migration):**
```jsx
{selectedContactId && (
  <SidePanel open onClose={() => setSelectedContactId(null)}>
    <ContactPanelBody
      contact={contacts.find(c => c.id === selectedContactId)}
      contacts={contacts}
      interactions={interactions}
      contactRelationships={relationships}
      onClose={() => setSelectedContactId(null)}
      onSaved={() => { setSelectedContactId(null); onRefresh?.() }}
      onRefreshRelationships={onRefreshRelationships}
      onOpenContact={/* D-05 handler — see Shared Patterns below */}
    />
  </SidePanel>
)}
```

### `TodayTab.jsx` — dual rendering (Contact + Application)

**Current pattern (to be replaced):**
```jsx
{selectedContactId && <ContactDetailModal ...props />}
{selectedAppId && <ApplicationDetailModal ...props />}
```

**Exact prop lists must be preserved from current TodayTab.jsx implementation** — this research did not enumerate TodayTab's exact call sites; planner must read the file directly to capture every prop today.

### `CalendarTab.jsx` — dual rendering (Contact + Application)

**RESEARCH.md Pitfall 4 caveat applies:** CalendarTab currently omits several props from its modal calls (e.g., `contactRelationships`/`onRefreshRelationships` from ContactDetailModal, several from ApplicationDetailModal). These omissions should be preserved in the new panel calls to maintain exact behavioral equivalence.

### `ReferralCoverageTab.jsx` — Contact rendering

**Current pattern:** Renders ContactDetailModal when a coverage-gap contact is clicked.

### `PipelineTab.jsx` — Application rendering

**Current pattern:**
```jsx
{(selectedApp || addingNew) && (
  <ApplicationDetailModal
    app={selectedApp}
    onClose={() => { setSelectedApp(null); setAddingNew(false) }}
    onSaved={() => { setSelectedApp(null); setAddingNew(false); onRefresh?.() }}
    ...otherProps
  />
)}
```

**Note:** This call site exercises the `isNew` (addingNew) creation mode, which must be fully preserved.

### `jobBoards/RepoJobsView.jsx` — Job rendering

**Current pattern:**
```jsx
{selectedJob && (
  <JobDetailModal
    job={selectedJob}
    status={/* lookup in state */}
    blurb={/* lookup in state */}
    deadline={/* lookup in state */}
    onStatusChange={/* handler */}
    onClose={() => setSelectedJob(null)}
    onRecheckDeadline={/* handler */}
    prefs={/* from parent */}
  />
)}
```

---

## Shared Patterns

### Pattern 1: Responsive Slide Transform (D-02)

**Source:** `ui/Modal.jsx` (baseline) extended with responsive breakpoint-specific transforms

**Apply to:** `SidePanel.jsx` shell only

**Challenge:** framer-motion's `initial`/`animate`/`exit` object properties don't natively support different values per CSS media query breakpoint. Two recommended approaches:

1. **useMediaQuery hook + conditional transform object** (smallest bundle impact):
```jsx
const isDesktop = useMediaQuery('(min-width: 768px)')
const panelVariants = isDesktop
  ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
  : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

<motion.div {...panelVariants} transition={{ duration: 0.22, ease: 'easeOut' }} />
```

2. **CSS-only positioning + single framer-motion axis** (avoids hook):
```jsx
// Tailwind static classes: md:translate-x-0 (desktop), mobile (default): translate-y-100 (via dynamic Tailwind or inline style)
// framer-motion animates only opacity, CSS handles the axis
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
/>
```

Either approach is valid. The planner should pick one explicitly and document it as an implementation decision.

### Pattern 2: In-Place Stack Navigation (D-05)

**Source:** Pattern 3 from RESEARCH.md

**Apply to:** Parent tab components and/or a new shared host component

**Mechanism:** A small record stack (e.g., `const [stack, setStack] = useState([{ type: 'contact', id }])`), where:
- Opening a nested record: `setStack(s => [...s, { type: 'newType', id: newId }])`
- Back button visible when `stack.length > 1`
- Back button pops: `setStack(s => s.slice(0, -1))`
- SidePanel's body re-renders based on `stack[stack.length - 1]`

**Concrete trigger:** `ApplicationPanelBody`'s `NetworkAtCompany` sub-component currently renders:
```jsx
<button onClick={() => onOpenContact?.(c.id)} ...>
```
This `onOpenContact` call must receive a handler from SidePanel's host that pushes a new contact record onto the stack.

### Pattern 3: Demo Mode Compatibility

**Source:** `db.js` isDemoMode() branching (lines checking `window.location.pathname.startsWith('/demo')`)

**Apply to:** ContactPanelBody and ApplicationPanelBody

**Requirement (RESEARCH.md Pitfall 1):** Both Contact and Application panel bodies are reachable from `/demo` via NetworkTab (Table/Cards), TodayTab, and PipelineTab. All `db.js` calls (`addContact`, `updateContact`, `addApplication`, `updateApplication`, etc.) already handle demo mode transparently via in-memory `demoData.js`, so no special handling is needed in the new body components — just ensure they're not wrapped in any auth-gated condition that would prevent them from opening in `/demo`.

### Pattern 4: Header Slot with Optional Back Button

**Source:** `ui/Modal.jsx` sticky header pattern + lucide-react icons

**Apply to:** `SidePanel.jsx` header

**Example markup pattern:**
```jsx
<div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 flex items-center justify-between">
  <div className="flex items-center gap-2">
    {hasBack && (
      <button onClick={onBack} className="...lucide-react icon...">
        ← Back
      </button>
    )}
    <h2 className="text-base font-bold text-ink-900">{title}</h2>
  </div>
  <button onClick={onClose} className="...lucide-react or text icon...">✕</button>
</div>
```

---

## Shared Data/API Patterns

### `db.js` Function Usage

All panel bodies call the same Supabase-backed `db.js` functions that the existing modals use today:

**Contact operations:**
- `addContact(fields)` → creates, returns `{ id, ... }`
- `updateContact(id, fields)` → updates in-place
- `archiveContact(id)` → soft-delete
- `addContactRelationship({ fromContactId, toContactId, relationshipType })`
- `deleteContactRelationship(id)`

**Application operations:**
- `addApplication(fields)` → creates
- `updateApplication(id, fields)` → updates
- `archiveApplication(id)` → soft-delete
- `updateApplicationTriage(id, triageBucket)` → sets triage state only

No new `db.js` functions are needed — all operations reuse existing, already-proven calls.

### Interaction logging (LogInteractionModal)

Both Contact and Application panel bodies embed `LogInteractionModal` for inline interaction capture. This component remains unchanged and continues to call `addInteraction()` directly via `db.js`.

---

## No Analog Found

N/A — all new components have direct analogs (existing modals being ported) or inherit from established patterns (`Modal.jsx` → `SidePanel.jsx`).

---

## Metadata

**Analog search scope:** `app/src/components/` (all component files) + `app/src/ui/` (primitives)

**Files scanned:** 25+ component/utility files

**Pattern extraction date:** 2026-08-18

**Key decisions locked in CONTEXT.md:**
- D-01: Slide-over vs. centered modal → **Slide-over**
- D-02: Animation mechanism → **framer-motion `AnimatePresence` + responsive transforms**
- D-03: Monolithic vs. shell+body split → **Shell (`SidePanel.jsx`) + type-specific bodies**
- D-04: Extend Modal.jsx or new sibling → **New sibling (`SidePanel.jsx`), Modal.jsx untouched**
- D-05: Nested record navigation → **In-place stack-based swap with back button**

All architectural decisions remain fully specified; no ambiguity at pattern-extraction time.
