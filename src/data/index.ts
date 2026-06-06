import { Category, Village, UpgradeItem, LevelData } from '../types'

interface RawEntry {
  id: string
  name: string
  nameCn: string
  category: string
  village: string
  maxLevel: number
  levels: Array<{
    level: number
    upgradeCost?: number
    upgradeTime?: string
    townHallLevel?: number
    dps?: number
    hp?: number
    [key: string]: any
  }>
}

const intlFiles = import.meta.glob('./json/intl/**/*.json', { eager: true })
const cnFiles = import.meta.glob('./json/cn/**/*.json', { eager: true })

function load(files: Record<string, any>): UpgradeItem[] {
  return Object.values(files).map((mod: any) => {
    const raw = mod.default as RawEntry
    const levels: Record<string, LevelData> = {}
    raw.levels.forEach(lv => {
      const clean = { ...lv } as any
      if (clean.upgradeCost === null) delete clean.upgradeCost
      if (clean.upgradeTime === null) delete clean.upgradeTime
      if (clean.townHallLevel === null) delete clean.townHallLevel
      if (clean.dps === null) delete clean.dps
      if (clean.hp === null) delete clean.hp
      levels[String(lv.level)] = clean
    })
    return { ...raw, levels, category: raw.category as Category, village: raw.village as Village }
  })
}

export const internationalData: UpgradeItem[] = load(intlFiles)
export const chinaData: UpgradeItem[] = load(cnFiles)

export const categoryLabels: Record<string, string> = {
  troops: '兵种',
  heroes: '英雄',
  spells: '法术',
  buildings: '建筑',
  siege: '攻城机器',
  pets: '宠物',
  traps: '陷阱',
  walls: '城墙',
  equipment: '装备',
}

export function getItemsByVillage(data: UpgradeItem[], village: string): UpgradeItem[] {
  return data.filter(item => item.village === village)
}

export function getItemsByCategory(data: UpgradeItem[], category: string): UpgradeItem[] {
  return data.filter(item => item.category === category)
}

export function findItem(data: UpgradeItem[], id: string): UpgradeItem | undefined {
  return data.find(item => item.id === id)
}
