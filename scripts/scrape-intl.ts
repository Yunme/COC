import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const intlDir = join(__dirname, '../src/data/json/intl')
const cnDir = join(__dirname, '../src/data/json/cn')

function fetchText(url: string): string {
  const escaped = url.replace(/'/g, "'\\''")
  const out = execSync(`curl -sL '${escaped}'`, { timeout: 30000, encoding: 'utf-8' })
  if (!out) throw new Error(`Empty response: ${url}`)
  return out.replace(/^\uFEFF/, '')
}

function parseFrontmatter(md: string): Record<string, string> {
  const match = md.match(/^---\n([\s\S]*?)\n(?:---|\.\.\.)/)
  if (!match) return {}
  const fm: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(?:"(.+)"|(.+))$/)
    if (m) fm[m[1]] = m[2] !== undefined ? m[2] : m[3]
  }
  return fm
}

function splitTableRow(line: string): string[] {
  const parts = line.split('|')
  parts.shift()
  parts.pop()
  return parts.map(c => c.trim())
}

function extractTable(md: string): { headers: string[]; rows: string[][] } {
  const tableMatch = md.match(/<UnitTable[^>]*>\n\n([\s\S]*?)\n<\/UnitTable>/)
  if (!tableMatch) return { headers: [], rows: [] }
  const lines = tableMatch[1].split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 3) return { headers: [], rows: [] }
  const headers = splitTableRow(lines[0])
  const rows = lines.slice(2).map(line => splitTableRow(line))
    .filter(r => r.length > 0 && !r.every(c => c === '---' || c === '' || c === '--- ' || c === ' ---'))
  return { headers, rows }
}

function extractTableExtraInfo(md: string): Array<{ column: number; type: string }> {
  const match = md.match(/const tableExtraInfo\s*=\s*(\[[\s\S]*?\]);/)
  if (!match) return []
  try {
    const cleaned = match[1]
      .replace(/\/\/.*$/gm, '')
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"')
    return JSON.parse(cleaned)
  } catch { return [] }
}

function parseCost(val: string): number | null {
  const v = val.trim().replace(/,/g, '')
  if (v === '\\' || v === '-' || v === '—' || v === '') return null
  const numMatch = v.match(/^([\d.]+)([kMB])?$/)
  if (!numMatch) return null
  const n = parseFloat(numMatch[1])
  const suffix = numMatch[2]
  if (suffix === 'k') return Math.round(n * 1000)
  if (suffix === 'M') return Math.round(n * 1000000)
  if (suffix === 'B') return Math.round(n * 1000000000)
  return Math.round(n)
}

function parseTime(val: string): string | null {
  const v = val.trim()
  if (v === '\\' || v === '-' || v === '—' || v === '') return null
  const parts = v.split(',').map(s => parseInt(s.trim(), 10))
  if (parts.some(isNaN)) return null
  let days = 0, hours = 0, minutes = 0, seconds = 0
  if (parts.length === 1) [days] = parts
  else if (parts.length === 2) [days, hours] = parts
  else if (parts.length === 3) [days, hours, minutes] = parts
  else if (parts.length >= 4) [days, hours, minutes, seconds] = parts
  if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) return null
  const result: string[] = []
  if (days > 0) result.push(`${days}d`)
  if (hours > 0) result.push(`${hours}h`)
  if (minutes > 0) result.push(`${minutes}m`)
  if (seconds > 0 && result.length === 0) result.push(`${seconds}s`)
  return result.join('') || null
}

function extractEnglishName(canonical: string): string {
  const seg = canonical.split('/').pop() || ''
  return seg.replace(/^[\da-f]+-/, '').replace(/-/g, ' ')
}

function columnHeaderToKey(ch: string): string {
  const map: Record<string, string> = {
    '等级': 'level',
    '每秒伤害': 'dps',
    '每次伤害': 'damagePerHit',
    '生命值': 'hp',
    '升级花费': 'upgradeCost',
    '升级费用': 'upgradeCost',
    '升级时间': 'upgradeTime',
    '所需大本等级': 'townHallLevel',
    '所需实验室等级': 'requiredLabLevel',
    '升级后可获得的经验': 'upgradeExp',
    '所需铁匠铺等级': 'requiredBlacksmithLevel',
    '所需训练营等级': 'requiredBarracksLevel',
    '所需战宠小屋等级': 'requiredPetHouseLevel',
    '所需英雄殿堂等级': 'requiredHeroHallLevel',
    '日均耗油': 'dailyOilCost',
    '解锁帮手': 'unlockedHelper',
    '第几个兵营': 'campIndex',
    '第几个预备营': 'campIndex',
    '建造花费': 'upgradeCost',
    '建造时间': 'upgradeTime',
    '攻城机器等级': 'siegeMachineLevel',
    '改造目标': 'gearUpTarget',
    '所需夜世界双管加农炮等级': 'requiredDoubleCannonLevel',
    '所需改装时长': 'gearUpTime',
    '所需改装费用': 'gearUpCost',
    '所需加农炮等级': 'requiredCannonLevel',
  }
  const key = ch.trim().replace(/<br\s*\/?>/gi, '').replace(/\s+/g, '')
  if (map[key]) return map[key]
  const simplified = ch.trim().replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ')
  const words = simplified.split(/[\s/]+/).filter(Boolean)
  if (words.length <= 3) {
    return words.map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
  }
  return simplified
}

function parseCategoryPages(md: string): Map<string, { nameCn: string; category: string }> {
  const result = new Map<string, { nameCn: string; category: string }>()
  const sections = md.split(/<ListItems\s/g).slice(1)
  for (const section of sections) {
    const titleMatch = section.match(/title="([^"]+)"/)
    if (!titleMatch) continue
    const sectionTitle = titleMatch[1]
    let category = ''
    if (sectionTitle.includes('英雄')) category = 'heroes'
    else if (sectionTitle.includes('战宠') || sectionTitle.includes('宠物')) category = 'pets'
    else if (sectionTitle.includes('装备')) category = 'equipment'
    else if (sectionTitle.includes('兵种') || sectionTitle.includes('圣水兵') || sectionTitle.includes('黑水兵') || sectionTitle.includes('超级兵')) category = 'troops'
    else if (sectionTitle.includes('法术')) category = 'spells'
    else if (sectionTitle.includes('攻城')) category = 'siege'
    else if (sectionTitle.includes('陷阱')) category = 'traps'
    else if (sectionTitle.includes('城墙')) category = 'walls'
    else category = 'buildings'
    const itemRegex = /<ListItem\s+name="([^"]*)"[^>]*link="([^"]*)"/g
    let m
    while ((m = itemRegex.exec(section)) !== null) {
      result.set(m[2], { nameCn: m[1], category })
    }
  }
  return result
}

interface LevelData {
  level: number
  [key: string]: any
}

function processItem(rawUrl: string, link: string, nameCn: string, category: string, village: string): { id: string; name: string; nameCn: string; category: string; village: string; maxLevel: number; levels: LevelData[] } | null {
  let md: string
  try {
    md = fetchText(rawUrl)
  } catch (e) {
    console.error(`  Fetch failed: ${rawUrl}`)
    return null
  }
  const fm = parseFrontmatter(md)
  if (!fm.canonical) {
    console.error(`  No canonical for ${link}`)
    return null
  }
  const engName = extractEnglishName(fm.canonical)
  const cnName = fm.navTitle || fm.shownTitle || nameCn
  const itemVillage = fm.module === 'upgrade-bh' ? 'builder' : village
  const imgFolder = fm.imgFolder || null
  const unitInfoMatch = md.match(/<UnitInfo[^>]*\simgSrc="([^"]+)"/)
  const imgSrc = unitInfoMatch ? unitInfoMatch[1] : null
  const info = extractTableExtraInfo(md)
  const costColumns = new Set(info.filter(i => i.type === 'cost').map(i => i.column))
  const timeColumns = new Set(info.filter(i => i.type === 'time').map(i => i.column))
  const { headers, rows } = extractTable(md)
  if (rows.length === 0) {
    console.error(`  No table data for ${link}`)
    return null
  }
  const columnKeys: string[] = headers.map((h, i) => {
    if (costColumns.has(i)) return 'upgradeCost'
    if (timeColumns.has(i)) return 'upgradeTime'
    return columnHeaderToKey(h)
  })
  const levels: LevelData[] = []
  for (const row of rows) {
    if (row.length !== columnKeys.length) continue
    const entry: LevelData = { level: 0 }
    for (let i = 0; i < columnKeys.length; i++) {
      const key = columnKeys[i]
      const val = row[i].trim()
      if (key === 'level') {
        entry.level = parseInt(val, 10)
      } else if (key === 'upgradeCost') {
        const cost = parseCost(val)
        if (cost !== null) entry.upgradeCost = cost
      } else if (key === 'upgradeTime') {
        const time = parseTime(val)
        if (time !== null) entry.upgradeTime = time
      } else if (key === 'townHallLevel' || key === 'requiredLabLevel' || key === 'requiredBarracksLevel' || key === 'requiredBlacksmithLevel') {
        const n = parseInt(val, 10)
        if (!isNaN(n)) entry[key] = n
      } else if (key === 'dps' || key === 'damagePerHit') {
        const n = parseFloat(val)
        if (!isNaN(n)) entry[key] = n
      } else if (key === 'hp') {
        const n = parseFloat(val)
        if (!isNaN(n)) entry[key] = n
      } else if (key === 'upgradeExp') {
        const n = parseInt(val, 10)
        if (!isNaN(n)) entry[key] = n
      } else if (val !== '\\' && val !== '-' && val !== '—' && val !== '') {
        const n = parseFloat(val)
        if (!isNaN(n)) entry[key] = n
        else entry[key] = val
      }
    }
    if (entry.level > 0) levels.push(entry)
  }
  if (levels.length === 0) {
    console.error(`  No levels parsed for ${link}`)
    return null
  }
  let id = decodeURIComponent(link).replace(/^[\da-f]+-/, '').replace(/'/g, '').replace(/\./g, '').replace(/’s/g, 's').toLowerCase()
  if (itemVillage === 'builder') id = `bh-${id}`
  return { id, name: engName, nameCn: cnName, category, village: itemVillage, maxLevel: levels.length, levels, imgFolder, imgSrc }
}

function main() {
  console.log('Fetching category pages...')
  const homeMd = fetchText('https://raw.githubusercontent.com/lemonicy/clashpost/main/docs/upgrade/category/home.md')
  const bhMd = fetchText('https://raw.githubusercontent.com/lemonicy/clashpost/main/docs/upgrade/category/bh.md')
  const homeMap = parseCategoryPages(homeMd)
  const bhMap = parseCategoryPages(bhMd)
  console.log(`  Home items: ${homeMap.size}, BH items: ${bhMap.size}`)
  const tmpDir = join(__dirname, '../src/data/json/.intl-tmp')
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })
  const allLinks = new Map<string, { nameCn: string; category: string; village: string }>()
  for (const [k, v] of homeMap) allLinks.set(k, { ...v, village: 'home' })
  for (const [k, v] of bhMap) allLinks.set(k, { ...v, village: 'builder' })
  let processed = 0, failed = 0
  const catCounts: Record<string, number> = {}
  const base = 'https://raw.githubusercontent.com/lemonicy/clashpost/main/docs/upgrade'
  for (const [link, info] of allLinks) {
    const item = processItem(`${base}/${link}.md`, link, info.nameCn, info.category, info.village)
    if (item) {
      const catDir = join(tmpDir, item.category)
      mkdirSync(catDir, { recursive: true })
      writeFileSync(join(catDir, `${item.id}.json`), JSON.stringify(item, null, 2))
      processed++
      catCounts[item.category] = (catCounts[item.category] || 0) + 1
    } else {
      failed++
    }
  }
  console.log(`\n=== Results ===`)
  console.log(`  Processed: ${processed}, Failed: ${failed}`)
  for (const [cat, count] of Object.entries(catCounts).sort()) {
    console.log(`  ${cat}: ${count}`)
  }
  const total = readdirSync(tmpDir).reduce((s, c) => s + (statSync(join(tmpDir, c)).isDirectory() ? readdirSync(join(tmpDir, c)).length : 0), 0)
  console.log(`\nTotal intl items: ${total}`)

  console.log('\nSwapping data directories...')
  rmSync(intlDir, { recursive: true, force: true })
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
  copyDir(tmpDir, intlDir)
  copyDir(intlDir, cnDir)
  rmSync(tmpDir, { recursive: true, force: true })
  console.log('  Done')
}

main()
