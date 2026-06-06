import { mkdirSync, readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const intlDir = join(__dirname, '../src/data/json/intl')
const imgDir = join(__dirname, '../public/images')

const BASE = 'https://static.clashpost.com/upgrade'
const pairs = new Set<string>()

for (const cat of readdirSync(intlDir)) {
  const catDir = join(intlDir, cat)
  if (!statSync(catDir).isDirectory()) continue
  for (const f of readdirSync(catDir)) {
    if (!f.endsWith('.json')) continue
    const d = JSON.parse(readFileSync(join(catDir, f), 'utf-8'))
    if (d.imgFolder && d.imgSrc) pairs.add(`${d.imgFolder}|${d.imgSrc}`)
  }
}

console.log(`Images to download: ${pairs.size}`)

let ok = 0, fail = 0
for (const pair of pairs) {
  const [folder, src] = pair.split('|')
  const out = join(imgDir, folder, src)
  if (existsSync(out)) { ok++; continue }
  mkdirSync(join(imgDir, folder), { recursive: true })
  const url = `${BASE}/${folder}/${src}`
  const sq = (s: string) => `'${s.replace(/'/g, "'\\''")}'`
  try {
    execSync(`curl -sL --connect-timeout 10 --max-time 30 -A 'Mozilla/5.0' -o ${sq(out)} ${sq(url)}`, { timeout: 35000, stdio: 'ignore' })
    ok++; process.stdout.write('.')
  } catch { fail++; process.stdout.write('x') }
}

console.log(`\nDone: ${ok} OK, ${fail} failed`)
