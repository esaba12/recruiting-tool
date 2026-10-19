import { describe, it, expect } from 'vitest'
import { parseCsvRows } from '../src/lib/csv.js'
import { parseLooseDate } from '../src/lib/dates.js'
import { parseTrackerCsv, parseLinkedInCsv, normalizeStage, isUntouchedImport, IMPORTED_CONNECTION_SOURCE } from '../src/lib/trackerImport.js'
import { keepInTouchQueue } from '../src/lib/keepInTouch.js'

// v1.4 spec 01: bring an existing spreadsheet tracker and LinkedIn connections in, no AI key.

const TODAY = '2026-10-19'

describe('parseCsvRows', () => {
  it('handles quoted commas, doubled quotes and newlines inside quotes', () => {
    const rows = parseCsvRows('Company,Notes\r\n"Stripe, Inc.","said ""hi""\nthen left"\nRamp,ok\n')
    expect(rows).toEqual([['Company', 'Notes'], ['Stripe, Inc.', 'said "hi"\nthen left'], ['Ramp', 'ok']])
  })
  it('splits pasted spreadsheet rows on tabs only, so commas in cells survive', () => {
    expect(parseCsvRows('Company\tRole\nJane Street, LLC\tQuant Trader')).toEqual([['Company', 'Role'], ['Jane Street, LLC', 'Quant Trader']])
  })
  it('skips blank lines', () => {
    expect(parseCsvRows('a,b\n\n1,2\n,\n')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseLooseDate', () => {
  it('reads the formats people type, as local days', () => {
    expect(parseLooseDate('2026-09-03', TODAY)).toBe('2026-09-03')
    expect(parseLooseDate('9/3/2026', TODAY)).toBe('2026-09-03')
    expect(parseLooseDate('Sep 3', TODAY)).toBe('2026-09-03')
    expect(parseLooseDate('15 Oct 2024', TODAY)).toBe('2024-10-15')
  })
  it('rejects future dates and junk', () => {
    expect(parseLooseDate('2026-12-01', TODAY)).toBeNull()
    expect(parseLooseDate('soon', TODAY)).toBeNull()
  })
})

describe('normalizeStage', () => {
  it('maps the statuses people write to pipeline stages', () => {
    expect(normalizeStage('Rejected')).toBe('Rejected')
    expect(normalizeStage('no offer')).toBe('Rejected')
    expect(normalizeStage('Interviewing')).toBe('Phone Screen')
    expect(normalizeStage('Superday')).toBe('Onsite')
    expect(normalizeStage('Final round')).toBe('Onsite')
    expect(normalizeStage('OA')).toBe('Applied')
    expect(normalizeStage('Offer received')).toBe('Offer')
    expect(normalizeStage('Accepted')).toBe('Accepted')
    expect(normalizeStage('want to apply')).toBe('Wishlist')
  })
  it('falls back on whether there is an applied date', () => {
    expect(normalizeStage('', { applied: true })).toBe('Applied')
    expect(normalizeStage('', { applied: false })).toBe('Wishlist')
  })
})

describe('parseTrackerCsv', () => {
  const csv = [
    'Firm,Position,Status,Date Applied,Link,Notes',
    'Goldman Sachs,Summer Analyst,Superday,9/3/2026,https://gs.com/apply,coffee with Jane',
    'Evercore,IB Summer Analyst,,2026-09-10,,',
    'Lazard,Summer Analyst,want to apply,,,',
    ',Missing company,Applied,,,',
    'goldman sachs ,summer analyst,Applied,,,',
  ].join('\n')

  it('maps header synonyms and statuses, and skips rows with no company', () => {
    const r = parseTrackerCsv(csv, { today: TODAY })
    expect(r.error).toBeUndefined()
    expect(r.rows.map(x => [x.company, x.role, x.stage, x.appliedDate])).toEqual([
      ['Goldman Sachs', 'Summer Analyst', 'Onsite', '2026-09-03'],
      ['Evercore', 'IB Summer Analyst', 'Applied', '2026-09-10'],
      ['Lazard', 'Summer Analyst', 'Wishlist', null],
    ])
    expect(r.rows[0]).toMatchObject({ jdLink: 'https://gs.com/apply', notes: 'coffee with Jane' })
    expect(r.skipped).toBe(1)
    expect(r.duplicates).toBe(1) // the second Goldman row, same company + role
  })

  it('drops rows already tracked (normalized company + role)', () => {
    const r = parseTrackerCsv(csv, { today: TODAY, existingApps: [{ company: 'Evercore', role: 'ib summer analyst' }] })
    expect(r.rows.map(x => x.company)).toEqual(['Goldman Sachs', 'Lazard'])
    expect(r.duplicates).toBe(2)
  })

  it('explains a file with no company column', () => {
    expect(parseTrackerCsv('Role,Status\nSWE,Applied', { today: TODAY }).error).toMatch(/company/i)
  })
})

describe('parseLinkedInCsv', () => {
  // LinkedIn's export starts with a few "Notes:" lines before the real header.
  const csv = [
    'Notes:',
    '"When exporting your connection data, you may notice that some of the email addresses are missing."',
    '',
    'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
    'Priya,Shah,https://www.linkedin.com/in/priyashah,,Stripe,Software Engineer,15 Oct 2024',
    'Sam,Lee,https://www.linkedin.com/in/samlee,sam@x.com,,,02 Mar 2023',
    'Jane,Chen,https://www.linkedin.com/in/janechen/,,Goldman Sachs,Analyst,01 Jan 2025',
    ',,,,,,',
  ].join('\n')

  it('skips the preamble and reads every connection', () => {
    const r = parseLinkedInCsv(csv, { today: TODAY })
    expect(r.error).toBeUndefined()
    expect(r.rows.map(x => x.name)).toEqual(['Priya Shah', 'Sam Lee', 'Jane Chen'])
    expect(r.rows[0]).toMatchObject({ company: 'Stripe', title: 'Software Engineer', linkedin: 'https://www.linkedin.com/in/priyashah', connectedOn: '2024-10-15' })
    expect(r.rows[1]).toMatchObject({ company: '', email: 'sam@x.com' })
  })

  it('dedups on LinkedIn URL (trailing slash ignored), then on name + company', () => {
    const r = parseLinkedInCsv(csv, { today: TODAY, existingContacts: [
      { name: 'someone else', linkedin: 'https://linkedin.com/in/janechen' },
      { name: 'Priya Shah', company: 'stripe' },
    ] })
    expect(r.rows.map(x => x.name)).toEqual(['Sam Lee'])
    expect(r.duplicates).toBe(2)
  })

  it('explains a file that is not a LinkedIn export', () => {
    expect(parseLinkedInCsv('Name,Company\nA,B', { today: TODAY }).error).toMatch(/Connections/)
  })
})

describe('imported connections stay off Keep in Touch until you talk to them', () => {
  const imported = { id: 'c1', name: 'Priya', status: '🔴 Cold', source: IMPORTED_CONNECTION_SOURCE, lastInteraction: null }
  it('isUntouchedImport', () => {
    expect(isUntouchedImport(imported, [])).toBe(true)
    expect(isUntouchedImport(imported, [{ contactId: 'c1' }])).toBe(false)
    expect(isUntouchedImport({ ...imported, source: 'Email' }, [])).toBe(false)
  })
  it('keepInTouchQueue leaves them out, then includes them once something is logged', () => {
    expect(keepInTouchQueue([imported], []).length).toBe(0)
    const touched = { ...imported, lastInteraction: '2026-01-01' }
    expect(keepInTouchQueue([touched], [{ contactId: 'c1', type: 'Email', date: '2026-01-01' }]).length).toBe(1)
  })
})
