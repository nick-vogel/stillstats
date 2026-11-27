// Limits: these files are written from the Reporting API's documentation of
// `channel_reach_combined_a1` (channel_reports, read 2026-11-17), which gives neither the text form
// of `date` nor the scale of `video_thumbnail_impressions_ctr`. A real report file read on the
// production walk (#791) is what shows they match. Nor does it say that Google writes a row with a
// CTR above 1, which these files assume from #1040's staging diagnosis: Nick's staging check of
// #1040 after its deploy, every day Google still holds stored, is what shows a real file reads.
import { describe, expect, test } from 'vitest'
import { reachRowsOf } from './reach-report.ts'

const header =
  'date,channel_id,video_id,traffic_source_type,traffic_source_detail,operating_system,device_type,video_thumbnail_impressions,video_thumbnail_impressions_ctr'

function file(...rows: string[]): string {
  return [header, ...rows].join('\n')
}

describe('a reach report file', () => {
  test('reduces to one row per video, day and traffic source type, impressions summed and the CTR weighted by impressions', () => {
    const csv = file(
      '20261101,UC1,v1,5,cats,iOS,MOBILE,100,0.1',
      '20261101,UC1,v1,5,dogs,ANDROID,MOBILE,300,0.02',
      '20261101,UC1,v1,5,,WINDOWS,DESKTOP,0,0',
      '20261101,UC1,v1,3,,iOS,MOBILE,50,0.04',
    )

    expect(reachRowsOf(csv)).toEqual([
      // (100 x 0.1 + 300 x 0.02) / 400
      { videoId: 'v1', day: '2026-11-01', trafficSourceType: 5, impressions: 400, ctr: 0.04 },
      { videoId: 'v1', day: '2026-11-01', trafficSourceType: 3, impressions: 50, ctr: 0.04 },
    ])
  })

  test('a group with no impressions has a CTR of 0', () => {
    expect(reachRowsOf(file('20261101,UC1,v1,7,,iOS,MOBILE,0,0'))).toEqual([
      { videoId: 'v1', day: '2026-11-01', trafficSourceType: 7, impressions: 0, ctr: 0 },
    ])
  })

  test('finds each column by the header row, whatever the order', () => {
    const csv = [
      'video_thumbnail_impressions_ctr,device_type,video_thumbnail_impressions,video_id,date,traffic_source_type,channel_id,operating_system,traffic_source_detail,a_column_added_later',
      '0.05,TV,20,v2,20261102,1,UC1,ANDROID_TV,,x',
    ].join('\n')

    expect(reachRowsOf(csv)).toEqual([
      { videoId: 'v2', day: '2026-11-02', trafficSourceType: 1, impressions: 20, ctr: 0.05 },
    ])
  })

  test('reads a quoted field holding commas and quotes, such as a search term', () => {
    const csv = file('20261101,UC1,v1,5,"cats, dogs and ""birds""",iOS,MOBILE,10,0.1')

    expect(reachRowsOf(csv)).toEqual([
      { videoId: 'v1', day: '2026-11-01', trafficSourceType: 5, impressions: 10, ctr: 0.1 },
    ])
  })

  test('a file holding only its header row, a day with no data, gives no rows', () => {
    expect(reachRowsOf(`${header}\n`)).toEqual([])
  })

  test('a file missing a column the history needs is refused', () => {
    const withoutCtr = header.replace(',video_thumbnail_impressions_ctr', '')

    expect(() => reachRowsOf(`${withoutCtr}\n20261101,UC1,v1,5,,iOS,MOBILE,10`)).toThrow(
      'video_thumbnail_impressions_ctr',
    )
  })

  test('a row whose date is not a day refuses the file, and the refusal names the date column and no row value', () => {
    expect(() => reachRowsOf(file('2026/11/01,UC1,v1,5,,iOS,MOBILE,10,0.1'))).toThrow(
      /^A reach report row has no day in date$/,
    )
  })

  test('a row with a CTR above 1 counts all its clicks in its group, and the group stores a CTR of at most 1', () => {
    const csv = file(
      '20261101,UC1,v1,5,cats,iOS,MOBILE,10,1.5',
      '20261101,UC1,v1,5,dogs,iOS,MOBILE,30,0.5',
      '20261101,UC1,v1,3,,iOS,MOBILE,4,2',
    )

    expect(reachRowsOf(csv)).toEqual([
      // (10 x 1.5 + 30 x 0.5) / 40, where a row capped at 1 would give (10 + 15) / 40
      { videoId: 'v1', day: '2026-11-01', trafficSourceType: 5, impressions: 40, ctr: 0.75 },
      { videoId: 'v1', day: '2026-11-01', trafficSourceType: 3, impressions: 4, ctr: 1 },
    ])
  })

  test('a row with impressions below 0 refuses the file, and the refusal names the impressions rule and column', () => {
    expect(() => reachRowsOf(file('20261101,UC1,v1,5,,iOS,MOBILE,-3,0.1'))).toThrow(
      /^A reach report row has impressions below zero in video_thumbnail_impressions$/,
    )
  })

  test('a row with a CTR below 0 refuses the file, and the refusal names the CTR rule and column', () => {
    expect(() => reachRowsOf(file('20261101,UC1,v1,5,,iOS,MOBILE,10,-0.2'))).toThrow(
      /^A reach report row has a CTR below zero in video_thumbnail_impressions_ctr$/,
    )
  })
})
