import { useState, useRef } from 'react'
import { Section } from './ui/Section.jsx'
import ExploreTab from './ExploreTab.jsx'
import ReferralCoverageTab from './ReferralCoverageTab.jsx'
import DiscoverTab from './DiscoverTab.jsx'
import { Building2, Target, UserSearch } from 'lucide-react'

// Grow — the merged Companies -> Coverage -> People discovery funnel (GROW-01/GROW-02).
// Same "many Sections, one always-rendered page" shape as TodayTab.jsx, except each Section
// wraps an existing full component instead of a computed list. Owns two independent focus
// states (coverageFocus/peopleFocus) so a Companies-add event never touches peopleFocus and
// vice versa (RESEARCH.md anti-pattern warning) — see 03-CONTEXT.md D-01/D-04.
export default function GrowTab({ contacts, apps, interactions, contactRelationships, onRefresh, onRefreshRelationships, initialPeopleFocus = null }) {
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
        <ExploreTab apps={apps} onTargetAdded={goToCoverage} onFindPeople={goToPeople} />
      </Section>
      <div ref={coverageSectionRef}>
        <Section step="02" title="Coverage" icon={Target} accent="ink">
          <ReferralCoverageTab contacts={contacts} apps={apps} interactions={interactions}
            contactRelationships={contactRelationships} onRefresh={onRefresh}
            focus={coverageFocus} onFindPeople={goToPeople} />
        </Section>
      </div>
      <div ref={peopleSectionRef}>
        <Section step="03" title="People" icon={UserSearch} accent="ink">
          <DiscoverTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={onRefresh} focus={peopleFocus} />
        </Section>
      </div>
    </div>
  )
}
