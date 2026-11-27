import type { Device, OperatingSystem } from '@creator-analytics/api-types'
import { deviceBarsOf, operatingSystemBarsOf } from './devices.ts'
import { TopBarsSection } from './TopBarsSection.tsx'

// The headings are approved word for word in creator-analytics#268 on 2026-10-19.

/**
 * The device types the channel's engaged views came from, most engaged views first. With no device,
 * the heading and the empty state alone.
 */
export function Devices({ devices }: { devices: Device[] }) {
  return (
    <TopBarsSection heading="Devices (engaged views)" bars={deviceBarsOf(devices)} notes={[]} />
  )
}

/**
 * The operating systems the channel's engaged views came from, most engaged views first. With no
 * operating system, the heading and the empty state alone.
 */
export function OperatingSystems({ operatingSystems }: { operatingSystems: OperatingSystem[] }) {
  return (
    <TopBarsSection
      heading="Operating systems (engaged views)"
      bars={operatingSystemBarsOf(operatingSystems)}
      notes={[]}
    />
  )
}
