import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
const { parseGitHubInput } = await import('../src/github.js')

describe('parseGitHubInput', () => {
  const want = { type: 'repo', owner: 'SimplifyJobs', repo: 'Summer2026-Internships' }
  it.each([
    'SimplifyJobs/Summer2026-Internships',
    'https://github.com/SimplifyJobs/Summer2026-Internships',
    'github.com/SimplifyJobs/Summer2026-Internships/',
    'https://www.github.com/SimplifyJobs/Summer2026-Internships',
    // GitHub appends these when you click the README tab; they used to end up in the repo name.
    'https://github.com/SimplifyJobs/Summer2026-Internships?tab=readme-ov-file',
    'https://github.com/SimplifyJobs/Summer2026-Internships#readme',
    'https://github.com/SimplifyJobs/Summer2026-Internships/tree/dev?tab=readme-ov-file#summer-2026',
    'https://github.com/SimplifyJobs/Summer2026-Internships.git',
    '  SimplifyJobs/Summer2026-Internships  ',
  ])('%s', input => expect(parseGitHubInput(input)).toEqual(want))

  it('rejects non-repo input', () => {
    expect(parseGitHubInput('SimplifyJobs')).toBeNull()
    expect(parseGitHubInput('https://github.com/?tab=x')).toBeNull()
  })
})
