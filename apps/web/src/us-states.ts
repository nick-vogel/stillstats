import type { UsState } from '@creator-analytics/api-types'
import { type TopBar, topBarsOf } from './top-bars.ts'

// "Other states" and the state names are approved in creator-analytics#268 on 2026-10-19, each
// state by its English name, with Washington, D.C. and any territory Google answers. "Unknown
// state" for US-ZZ awaits Nick's approval: no approved text names it.

/**
 * English names by ISO 3166-2 code, as Google's `province` answers them: the 50 states, the
 * District of Columbia, and the territories ISO 3166-2:US lists. Google's dimensions page says it
 * answers the states and D.C., and `US-ZZ` for a state YouTube could not identify (checked
 * 2026-10-20); the territories are here in case it answers one.
 */
const usStateNames: Record<string, string> = {
  'US-AL': 'Alabama',
  'US-AK': 'Alaska',
  'US-AZ': 'Arizona',
  'US-AR': 'Arkansas',
  'US-CA': 'California',
  'US-CO': 'Colorado',
  'US-CT': 'Connecticut',
  'US-DE': 'Delaware',
  'US-FL': 'Florida',
  'US-GA': 'Georgia',
  'US-HI': 'Hawaii',
  'US-ID': 'Idaho',
  'US-IL': 'Illinois',
  'US-IN': 'Indiana',
  'US-IA': 'Iowa',
  'US-KS': 'Kansas',
  'US-KY': 'Kentucky',
  'US-LA': 'Louisiana',
  'US-ME': 'Maine',
  'US-MD': 'Maryland',
  'US-MA': 'Massachusetts',
  'US-MI': 'Michigan',
  'US-MN': 'Minnesota',
  'US-MS': 'Mississippi',
  'US-MO': 'Missouri',
  'US-MT': 'Montana',
  'US-NE': 'Nebraska',
  'US-NV': 'Nevada',
  'US-NH': 'New Hampshire',
  'US-NJ': 'New Jersey',
  'US-NM': 'New Mexico',
  'US-NY': 'New York',
  'US-NC': 'North Carolina',
  'US-ND': 'North Dakota',
  'US-OH': 'Ohio',
  'US-OK': 'Oklahoma',
  'US-OR': 'Oregon',
  'US-PA': 'Pennsylvania',
  'US-RI': 'Rhode Island',
  'US-SC': 'South Carolina',
  'US-SD': 'South Dakota',
  'US-TN': 'Tennessee',
  'US-TX': 'Texas',
  'US-UT': 'Utah',
  'US-VT': 'Vermont',
  'US-VA': 'Virginia',
  'US-WA': 'Washington',
  'US-WV': 'West Virginia',
  'US-WI': 'Wisconsin',
  'US-WY': 'Wyoming',
  'US-DC': 'Washington, D.C.',
  'US-AS': 'American Samoa',
  'US-GU': 'Guam',
  'US-MP': 'Northern Mariana Islands',
  'US-PR': 'Puerto Rico',
  'US-UM': 'U.S. Minor Outlying Islands',
  'US-VI': 'U.S. Virgin Islands',
  'US-ZZ': 'Unknown state',
}

/**
 * One bar for each of the first 10 states in the API's order, then, when there are more, one
 * "Other states" bar adding up the rest, each keyed by the state's code. A code the table does not
 * name shows as the code.
 */
export function usStateBarsOf(usStates: UsState[], locale?: string): TopBar[] {
  return topBarsOf(
    usStates.map(({ code, engagedViews }) => ({
      key: code,
      name: usStateNames[code] ?? code,
      engagedViews,
    })),
    'Other states',
    locale,
  )
}
