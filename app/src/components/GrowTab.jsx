import { useState, useRef } from 'react'
import { Section } from './ui/Section.jsx'
import ExploreTab from './ExploreTab.jsx'
import ReferralCoverageTab from './ReferralCoverageTab.jsx'
import DiscoverTab from './DiscoverTab.jsx'
import { useTargetCompanies } from '../lib/useTargetCompanies.js'
import { Building2, Target, UserSearch } from 'lucide-react'

// Grow — the merged Companies -> Coverage -> People discovery funnel (GROW-01/GROW-02).
// Same "many Sections, one always-rendered page" shape as TodayTab.jsx, except each Section
// wraps an existing full component instead of a computed list. Owns two independent focus
// states (coverageFocus/peopleFocus) so a Companies-add event never touches peopleFocus and
// vice versa (RESEARCH.md anti-pattern warning) — see 03-CONTEXT.md D-01/D-04.
//
// useTargetCompanies() is called exactly once here and threaded down as props (targets/
// setTargets/loaded) to all three sections — they used to each call the hook independently,
// which was safe only when Explore/Coverage/Discover were mutually-exclusive views/tabs.
// Now that all three render simultaneously on one page, three independent fetch-once copies
// would desync (an add in Companies never reaches Coverage/Discover's own stale `targets`,
// and Coverage's "Save target list" could silently overwrite Supabase with the stale list —
// see 03-REVIEW.md CR-01). GrowTab.jsx is confirmed (by repo-wide grep) to be the only render
// site for all three components, so this is a required-prop lift, not an optional one.
export default function GrowTab({ contacts, apps, interactions, contactRelationships, onRefresh, onRefreshRelationships, initialPeopleFocus = null }) {
  const { targets, setTargets, loaded: targetsLoaded } = useTargetCompanies()
  const [coverageFocus, setCoverageFocus] = useState(null) // { company, ts }
  const [peopleFocus, setPeopleFocus] = useState(initialPeopleFocus) // { company, ts }
  const coverageSectionRef = useRef(null)
  const peopleSectionRef = useRef(null)

  function goToCoverage(company) {
    coverageSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setCoverageFocus({ company, ts: Date.now() })
  }
  function goToPeople(company) {
    peopleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setPeopleFocus({ company, ts: Date.now() })
  }

  return (
    <div className="space-y-4">
      <Section step="01" title="Companies" icon={Building2} accent="ink">
        <ExploreTab apps={apps} onTargetAdded={goToCoverage} onFindPeople={goToPeople}
          targets={targets} setTargets={setTargets} loaded={targetsLoaded} />
      </Section>
      <div ref={coverageSectionRef}>
        <Section step="02" title="Coverage" icon={Target} accent="ink">
          <ReferralCoverageTab contacts={contacts} apps={apps} interactions={interactions}
            contactRelationships={contactRelationships} onRefresh={onRefresh}
            focus={coverageFocus} onFindPeople={goToPeople}
            targets={targets} setTargets={setTargets} loaded={targetsLoaded} />
        </Section>
      </div>
      <div ref={peopleSectionRef}>
        <Section step="03" title="People" icon={UserSearch} accent="ink">
          <DiscoverTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={onRefresh} focus={peopleFocus}
            targets={targets} loaded={targetsLoaded} />
        </Section>
      </div>
    </div>
  )
}
