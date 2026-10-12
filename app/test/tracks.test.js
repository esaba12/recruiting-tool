import { describe, it, expect } from 'vitest'
import { profileTracks, hasTrack, isTechOnly, tracksLabel, usesTechSources, stageLabel } from '../src/lib/tracks.js'
import { defaultTemplateKeys, TEMPLATES } from '../src/lib/learning/templates.js'

describe('profileTracks', () => {
  it('prefers explicit tracks over the legacy focus column', () => {
    expect(profileTracks({ tracks: ['ib', 'quant'], focus: 'SWE' })).toEqual(['ib', 'quant'])
  })
  it('falls back to legacy focus when tracks is empty', () => {
    expect(profileTracks({ tracks: [], focus: 'PM' })).toEqual(['pm'])
    expect(profileTracks({ tracks: [], focus: 'Both' })).toEqual(['swe', 'pm'])
    expect(profileTracks({ focus: 'SWE' })).toEqual(['swe'])
  })
  it('defaults to swe for a missing profile or unknown values', () => {
    expect(profileTracks(null)).toEqual(['swe'])
    expect(profileTracks({ tracks: ['bogus'] })).toEqual(['swe'])
  })
  it('drops unknown ids but keeps valid ones', () => {
    expect(profileTracks({ tracks: ['ib', 'bogus'] })).toEqual(['ib'])
  })
})

describe('track helpers', () => {
  it('hasTrack / isTechOnly', () => {
    expect(hasTrack({ tracks: ['swe', 'ib'] }, 'ib')).toBe(true)
    expect(isTechOnly({ tracks: ['swe', 'pm'] })).toBe(true)
    expect(isTechOnly({ tracks: ['swe', 'ib'] })).toBe(false)
    expect(isTechOnly(null)).toBe(true)
  })
  it('tracksLabel joins short labels in profile order', () => {
    expect(tracksLabel({ tracks: ['swe', 'ib'] })).toBe('SWE + IB / Finance')
    expect(tracksLabel({ focus: 'Both' })).toBe('SWE + PM')
  })
})

describe('defaultTemplateKeys', () => {
  it('maps every track to a Learn template', () => {
    for (const id of ['swe', 'pm', 'ib', 'quant', 'consulting']) expect(TEMPLATES[id]).toBeTruthy()
    expect(defaultTemplateKeys(['ib', 'consulting'])).toEqual(['ib', 'consulting'])
  })
  it('falls back to swe when nothing maps', () => {
    expect(defaultTemplateKeys([])).toEqual(['swe'])
    expect(defaultTemplateKeys(undefined)).toEqual(['swe'])
  })
})

describe('track-aware surfaces', () => {
  it('tech sources (job boards, YC) only for users with a swe or pm track', () => {
    expect(usesTechSources({ tracks: ['swe'] })).toBe(true)
    expect(usesTechSources({ tracks: ['ib', 'pm'] })).toBe(true)
    expect(usesTechSources({ tracks: ['ib'] })).toBe(false)
    expect(usesTechSources({ tracks: ['consulting', 'quant'] })).toBe(false)
  })
  it('stage labels gain finance names only for non-tech users, values unchanged', () => {
    expect(stageLabel('Onsite', { tracks: ['swe'] })).toBe('Onsite')
    expect(stageLabel('Onsite', { tracks: ['swe', 'ib'] })).toMatch(/Superday/)
    expect(stageLabel('Phone Screen', { tracks: ['consulting'] })).toMatch(/HireVue/)
    expect(stageLabel('Applied', { tracks: ['ib'] })).toBe('Applied')
  })
})
