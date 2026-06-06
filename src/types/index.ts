export type Category = string

export type Village = 'home' | 'builder'

export interface LevelData {
  level: number
  upgradeCost?: number
  upgradeTime?: string
  townHallLevel?: number
  dps?: number
  hp?: number
  [key: string]: any
}

export interface UpgradeItem {
  id: string
  name: string
  nameCn: string
  category: Category
  village: Village
  maxLevel: number
  levels: Record<string, LevelData>
  imgFolder?: string | null
  imgSrc?: string | null
}
