import { useState } from 'react'
import { Kanban, GitFork } from 'lucide-react'
import ApplicationsView from './ApplicationsView.jsx'
import JobBoardsView from './jobBoards/JobBoardsView.jsx'

// Merged Pipeline destination shell delivering PIPE-01: a segmented control over two
// mutually exclusive bodies (Applications | Job Boards), so only one body ever mounts
// at a time — Job Boards' auto-import/deadline-fetch effects must not run while the
// user is looking at Applications. The two bodies deliberately take differently-named
// refresh callbacks (onRefresh vs. onImported) that both resolve to the same App.jsx
// `load` function; the shell's signature defaults the Job Boards callback from the
// Applications one so no new prop needs to be threaded from App.jsx.

const PIPELINE_VIEWS = [
  { key: 'applications', label: 'Applications', icon: Kanban },
  { key: 'jobBoards',    label: 'Job Boards',    icon: GitFork },
]

export const DEMO_PIPELINE_VIEWS = PIPELINE_VIEWS.filter(v => v.key === 'applications')

export default function PipelineTab({ apps, contacts = [], interactions = [], relationships = [], onRefresh, onImported = onRefresh, onFindPeople, onRefreshRelationships, views = PIPELINE_VIEWS }) {
  const [view, setView] = useState('applications')

  return (
    <div>
      {views.length > 1 && (
        <div className="flex mb-4">
          <div className="flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium">
            {views.map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${view === v.key ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50'}`}>
                <v.icon size={13} strokeWidth={2.25} />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'applications'
        ? <ApplicationsView apps={apps} contacts={contacts} interactions={interactions} relationships={relationships} onRefresh={onRefresh} onFindPeople={onFindPeople} onRefreshRelationships={onRefreshRelationships} />
        : <JobBoardsView apps={apps} onImported={onImported} />}
    </div>
  )
}
