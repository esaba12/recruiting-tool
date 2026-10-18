import { Kanban, GitFork, Sheet } from 'lucide-react'
import { usesTechSources } from '../lib/tracks.js'

// Lives apart from PipelineTab.jsx so App.jsx can pick a user's views without pulling the
// lazily loaded Pipeline tab into the entry chunk (v1.3 spec 09).
export const PIPELINE_VIEWS = [
  { key: 'applications', label: 'Applications', icon: Kanban },
  { key: 'sheet',        label: 'Sheet',         icon: Sheet },
  { key: 'jobBoards',    label: 'Job Boards',    icon: GitFork },
]

export const DEMO_PIPELINE_VIEWS = PIPELINE_VIEWS.filter(v => v.key !== 'jobBoards')

// Job Boards is built on GitHub internship repos (tech-only), so non-tech users don't get it.
export function pipelineViewsFor(profile) {
  return usesTechSources(profile) ? PIPELINE_VIEWS : DEMO_PIPELINE_VIEWS
}
