import {
  Armchair, Car, Chair, Couch, Cube, Desktop, DeviceMobile, Engine, Fan, Laptop, Lightning,
  Monitor, Printer, ProjectorScreen, Snowflake, Television, WifiHigh,
  type Icon, type IconWeight,
} from '@phosphor-icons/react'

const map: Record<string, Icon> = {
  laptop: Laptop,
  desktop: Desktop,
  monitor: Monitor,
  printer: Printer,
  chair: Chair,
  armchair: Armchair,
  couch: Couch,
  'projector-screen': ProjectorScreen,
  car: Car,
  'device-mobile': DeviceMobile,
  'wifi-high': WifiHigh,
  'air-conditioner': Snowflake,
  snowflake: Snowflake,
  fan: Fan,
  lightning: Lightning,
  engine: Engine,
  generator: Lightning,
  television: Television,
}

export function AssetIcon({ name, size = 24, weight = 'light', className }: { name?: string | null; size?: number; weight?: IconWeight; className?: string }) {
  const I = (name && map[name]) || Cube
  return <I size={size} weight={weight} className={className} />
}
