import { writeFileSync, readFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const intlDir = join(__dirname, '../src/data/json/intl')
const cnDir = join(__dirname, '../src/data/json/cn')

const LIST_URL = 'https://clashofclan.top/china/queryCocInfoNew'

function fetchJson(url: string, retries = 2): any {
  for (let i = 0; i <= retries; i++) {
    try {
      const escaped = url.replace(/'/g, "'\\''")
      const out = execSync(`curl -sL --connect-timeout 10 --max-time 25 '${escaped}'`, { timeout: 30000, encoding: 'utf-8' })
      if (!out) continue
      return JSON.parse(out)
    } catch {
      if (i < retries) continue
      throw new Error(`Failed after ${retries + 1} attempts: ${url}`)
    }
  }
}

function secToTime(sec: number): string | null {
  if (sec <= 0) return null
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return h > 0 ? `${d}d${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

// Map CN API Chinese names (nameZh) to intl nameCn (for items where names differ)
const NAME_OVERRIDES: Record<string, string> = {
  '伤害药水法术': '毒药法术',
  '疯狂蔓生法术': '蔓生法术',
  '治疗胡须': '嗜血胡须',
  '17本地狱火炮': '地狱火炮',
  '十字连弩': 'X连弩（十字连弩）',
}

function matchIntl(intlMap: Map<string, any>, nameZh: string, village: string): any | null {
  const key = `${village}|${nameZh}`
  const exact = intlMap.get(key)
  if (exact) return exact

  const mapped = NAME_OVERRIDES[nameZh]
  if (mapped) {
    const alt = intlMap.get(`${village}|${mapped}`)
    if (alt) return alt
  }

  return null
}

function loadIntlMap(): Map<string, any> {
  const map = new Map<string, any>()
  for (const catDir of readdirSync(intlDir)) {
    const dir = join(intlDir, catDir)
    if (!statSync(dir).isDirectory()) continue
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      const data = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
      map.set(`${data.village}|${data.nameCn}`, data)
    }
  }
  return map
}

function main() {
  console.log('Loading intl data for name matching...')
  const intlMap = loadIntlMap()
  console.log(`  Intl items loaded: ${intlMap.size}`)

  console.log('Fetching CN list API...')
  const listData = fetchJson(LIST_URL)
  const villageMap: Record<string, string> = { home: 'home', night: 'builder' }

  const tmpDir = join(__dirname, '../src/data/json/.cn-tmp')
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })

  let matched = 0, failed = 0, skipped = 0
  const catCounts: Record<string, number> = {}

  for (const [villageKey, villageItems] of Object.entries(listData)) {
    const village = villageMap[villageKey]
    if (!village) continue

    for (const section of (villageItems as any[])) {
      const items = section.list as any[] || []

      for (const item of items) {
        if (item.countryType !== 0) continue

        const nameZh = item.nameZh as string
        const listName = item.name as string
        const intlItem = matchIntl(intlMap, nameZh, village)

        if (!intlItem) {
          console.warn(`  No intl match: ${village}/${section.type} "${nameZh}"`)
          skipped++
          continue
        }

        const actualMaxLevel = intlItem.levels.reduce((m: number, lv: any) => Math.max(m, lv.level), 0) || intlItem.maxLevel
        const detailUrl = `https://clashofclan.top/china/queryCocInfoByNameNew?name=${encodeURIComponent(listName)}&countryType=0&vipType=1&minLevel=1&maxLevel=${actualMaxLevel}`
        let detail: any
        try {
          detail = fetchJson(detailUrl)
        } catch {
          console.error(`  Detail fetch failed: ${intlItem.id} (${listName})`)
          failed++
          continue
        }

        const levelList = detail.list as any[]
        if (!levelList || levelList.length === 0) {
          console.error(`  No level data: ${intlItem.id}`)
          failed++
          continue
        }

        const levels: any[] = []
        for (const lv of levelList) {
          const levelNum = parseInt(lv.level)
          if (isNaN(levelNum) || levelNum < 1) continue

          const entry: any = { level: levelNum }

          if (lv.hurt !== undefined) {
            const n = parseFloat(lv.hurt)
            if (!isNaN(n)) entry.dps = n
          }

          const dmgField = lv.damage_per_hit ?? lv.damage_per_attack ?? lv.damage_per_shot
          if (dmgField !== undefined) {
            const n = parseFloat(dmgField)
            if (!isNaN(n)) entry.damagePerHit = n
          }

          if (lv.health !== undefined) {
            const n = parseFloat(lv.health)
            if (!isNaN(n)) entry.hp = n
          }

          if (lv.upgradeResoures !== undefined) {
            const n = parseInt(lv.upgradeResoures)
            if (!isNaN(n) && n > 0) entry.upgradeCost = n
          }

          if (lv.upgradeTime !== undefined) {
            const sec = parseInt(lv.upgradeTime)
            if (!isNaN(sec)) {
              const timeStr = secToTime(sec)
              if (timeStr) entry.upgradeTime = timeStr
            }
          }

          if (lv.campLevel !== undefined) {
            const n = parseInt(lv.campLevel)
            if (!isNaN(n)) entry.townHallLevel = n
          }

          if (Object.keys(entry).length > 1) levels.push(entry)
        }

        if (levels.length === 0) {
          console.error(`  No levels parsed: ${intlItem.id}`)
          failed++
          continue
        }

        const usedMaxLevel = parseInt(detail.maxLevel) || levels.length

        const outItem: any = {
          id: intlItem.id,
          name: intlItem.name,
          nameCn: nameZh,
          category: intlItem.category,
          village: intlItem.village,
          maxLevel: usedMaxLevel,
          levels,
          imgFolder: intlItem.imgFolder || null,
          imgSrc: intlItem.imgSrc || null,
        }

        const catDir = join(tmpDir, intlItem.category)
        mkdirSync(catDir, { recursive: true })
        writeFileSync(join(catDir, `${intlItem.id}.json`), JSON.stringify(outItem, null, 2))
        matched++
        catCounts[intlItem.category] = (catCounts[intlItem.category] || 0) + 1
      }
    }
  }

  console.log(`\n=== Results ===`)
  console.log(`  Matched: ${matched}, Failed: ${failed}, Skipped (no intl match): ${skipped}`)
  for (const [cat, count] of Object.entries(catCounts).sort()) {
    console.log(`  ${cat}: ${count}`)
  }
  const total = readdirSync(tmpDir).reduce((s, c) => s + (statSync(join(tmpDir, c)).isDirectory() ? readdirSync(join(tmpDir, c)).length : 0), 0)
  console.log(`\nTotal CN items: ${total}`)

  console.log('\nSwapping data directories...')
  rmSync(cnDir, { recursive: true, force: true })
  function copyDir(src: string, dst: string) {
    mkdirSync(dst, { recursive: true })
    for (const entry of readdirSync(src)) {
      const sp = join(src, entry)
      const dp = join(dst, entry)
      if (statSync(sp).isDirectory()) copyDir(sp, dp)
      else copyFileSync(sp, dp)
    }
  }
  copyDir(tmpDir, cnDir)
  rmSync(tmpDir, { recursive: true, force: true })
  console.log('  Done')
}

main()
