import { describe, it, expect } from 'vitest'
import { locationRegions, primaryRegion, matchesRegions, regionCounts, groupByRegion, UNSPECIFIED } from '../src/lib/locations.js'

describe('locationRegions', () => {
  it('folds aliases into one region', () => {
    expect(locationRegions('San Francisco, CA')).toEqual(['Bay Area'])
    expect(locationRegions('SF')).toEqual(['Bay Area'])
    expect(locationRegions('Mountain View, CA')).toEqual(['Bay Area'])
    expect(locationRegions('NYC')).toEqual(['New York'])
    expect(locationRegions('New York, NY')).toEqual(['New York'])
    expect(locationRegions('Redmond, WA')).toEqual(['Seattle'])
    expect(locationRegions('Washington, DC')).toEqual(['Washington DC'])
  })

  it('splits multi-location cells and dedupes', () => {
    expect(locationRegions('San Francisco, CA, New York, NY, Palo Alto, CA')).toEqual(['Bay Area', 'New York'])
    expect(locationRegions('Seattle, WA; Remote in USA')).toEqual(['Seattle', 'Remote'])
    expect(locationRegions('3 locations, Austin, TX, Chicago, IL')).toEqual(['Austin', 'Chicago'])
  })

  it('keeps unknown cities as themselves, minus state and country', () => {
    expect(locationRegions('Ann Arbor, MI')).toEqual(['Ann Arbor'])
    expect(locationRegions('ann arbor, michigan, USA')).toEqual(['Ann Arbor'])
    expect(locationRegions('Toronto, ON, Canada')).toEqual(['Toronto'])
    expect(locationRegions('London, UK')).toEqual(['London'])
  })

  it('treats remote variants as Remote and drops work-style words', () => {
    expect(locationRegions('Remote')).toEqual(['Remote'])
    expect(locationRegions('USA (Remote)')).toEqual(['Remote'])
    expect(locationRegions('Boston, MA (Hybrid)')).toEqual(['Boston'])
  })

  it('returns Unspecified for empty or country-only values', () => {
    expect(locationRegions('')).toEqual([UNSPECIFIED])
    expect(locationRegions(null)).toEqual([UNSPECIFIED])
    expect(locationRegions('USA')).toEqual([UNSPECIFIED])
  })
})

describe('helpers', () => {
  const items = [
    { id: 1, location: 'San Francisco, CA' },
    { id: 2, location: 'NYC, SF' },
    { id: 3, location: 'Remote' },
    { id: 4, location: '' },
    { id: 5, location: 'Palo Alto' },
  ]

  it('primaryRegion is the first region', () => {
    expect(primaryRegion('NYC, SF')).toBe('New York')
  })

  it('matchesRegions passes everything when nothing is selected', () => {
    expect(matchesRegions('NYC', [])).toBe(true)
    expect(matchesRegions('NYC, SF', ['Bay Area'])).toBe(true)
    expect(matchesRegions('Remote', ['Bay Area', 'New York'])).toBe(false)
  })

  it('regionCounts counts each item once per region, biggest first, Unspecified last', () => {
    expect(regionCounts(items)).toEqual([['Bay Area', 3], ['New York', 1], ['Remote', 1], [UNSPECIFIED, 1]])
  })

  it('groupByRegion puts multi-location items in every group they belong to', () => {
    const groups = groupByRegion(items)
    expect(groups.map(g => g.region)).toEqual(['Bay Area', 'New York', 'Remote', UNSPECIFIED])
    expect(groups[0].items.map(i => i.id)).toEqual([1, 2, 5])
    expect(groups[1].items.map(i => i.id)).toEqual([2])
  })

  it('groupByRegion can keep only selected regions', () => {
    expect(groupByRegion(items, ['New York']).map(g => g.region)).toEqual(['New York'])
  })
})
