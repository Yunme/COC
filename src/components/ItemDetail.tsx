import { useState } from 'react'
import { UpgradeItem } from '../types'
import { chinaData } from '../data'

interface Props {
  item: UpgradeItem
  onBack: () => void
}

const GP_OPTIONS = [0, 10, 15, 20]
const SEC_DAY = 86400
const SEC_HOUR = 3600
const SEC_MIN = 60

function parseTimeToSec(time: string): number {
  let s = 0
  const d = time.match(/(\d+)d/)
  const h = time.match(/(\d+)h/)
  const m = time.match(/(\d+)m/)
  const sec = time.match(/(\d+)s/)
  if (d) s += parseInt(d[1]) * SEC_DAY
  if (h) s += parseInt(h[1]) * SEC_HOUR
  if (m) s += parseInt(m[1]) * SEC_MIN
  if (sec) s += parseInt(sec[1])
  return s
}

function sumTimeSec(item: UpgradeItem): number {
  let total = 0
  for (const lv of Object.values(item.levels)) {
    if (lv.upgradeTime) total += parseTimeToSec(lv.upgradeTime)
  }
  return total
}

function fmtTimeFromSec(sec: number): string {
  if (sec <= 0) return '0h'
  const d = Math.floor(sec / SEC_DAY)
  const h = Math.floor((sec % SEC_DAY) / SEC_HOUR)
  const m = Math.round((sec % SEC_HOUR) / SEC_MIN)
  if (d > 0 && h > 0) return `${d}d${h}h`
  if (d > 0) return `${d}d`
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function getDiscountTimeSec(sec: number, gp: number): number {
  if (gp <= 0) return sec
  const mult = 1 - gp / 100
  if (sec < 30 * SEC_MIN) return Math.ceil(sec * mult)
  if (sec < SEC_DAY) return Math.floor(Math.floor(sec * mult) / 600) * 600
  return Math.floor(Math.floor(sec * mult) / SEC_HOUR) * SEC_HOUR
}

function applyCost(cost: number | undefined, gp: number): number | undefined {
  if (cost === undefined || cost === null || gp <= 0) return cost
  return Math.ceil(cost * (1 - gp / 100))
}

function applyTime(time: string | undefined, gp: number): string | undefined {
  if (!time || gp <= 0) return time
  const sec = parseTimeToSec(time)
  if (sec <= 0) return time
  return fmtTimeFromSec(getDiscountTimeSec(sec, gp))
}

function formatCost(cost: number | undefined): string {
  if (cost === undefined || cost === null) return '-'
  if (cost >= 10000) return (cost / 10000 % 1 === 0 ? cost / 10000 : (cost / 10000).toFixed(1)) + '万'
  return cost.toLocaleString()
}

function vs(intVal: string | number, cnVal: string | number): string {
  return `${intVal} vs ${cnVal}`
}

function getDisplayLevels(item: UpgradeItem): string[] {
  return Array.from({ length: item.maxLevel }, (_, i) => i + 1).map(String)
}

function isDifferent(item1: UpgradeItem, item2: UpgradeItem, level: string, gp: number): boolean {
  const l1 = item1.levels[level]
  const l2 = item2.levels[level]
  if (!l1 || !l2) return false
  return (
    applyCost(l1.upgradeCost, gp) !== applyCost(l2.upgradeCost, gp) ||
    applyTime(l1.upgradeTime, gp) !== applyTime(l2.upgradeTime, gp) ||
    l1.dps !== l2.dps ||
    l1.hp !== l2.hp
  )
}

export default function ItemDetail({ item, onBack }: Props) {
  const [gp, setGp] = useState(0)
  const cnItem = chinaData.find(c => c.id === item.id) || item
  const levels = getDisplayLevels(item)
  const gpSuffix = gp > 0 ? `(含${gp}%月卡)` : ''

  const baseCols = ['等级', '大本营等级']
  const pairCols = ['升级费用', '升级时间', 'DPS', 'HP']
  const columns = [...baseCols, ...pairCols.map(c => {
    if (c === 'DPS' || c === 'HP') return c
    return `${c}\n国际 vs 国服${gpSuffix}`
  })]

  return (
    <div className="item-detail">
      <button className="back-btn" onClick={onBack} aria-label="返回列表">← 返回列表</button>

      <div className="gp-bar">
        <span className="gp-label">月卡减免</span>
        <div className="gp-btns">
          {GP_OPTIONS.map(pct => (
            <button
              key={pct}
              className={`gp-btn ${gp === pct ? 'gp-btn-active' : ''}`}
              onClick={() => setGp(pct)}
            >
              {pct > 0 ? `-${pct}%` : '关闭'}
            </button>
          ))}
        </div>
      </div>

      <div className="item-section">
        <h3 className="item-title">{item.nameCn} ({item.name})</h3>

        <div className="time-summary">
          <span>国际总升级时间: <strong>{fmtTimeFromSec(sumTimeSec(item))}</strong></span>
          <span>国服总升级时间: <strong>{fmtTimeFromSec(sumTimeSec(cnItem))}</strong></span>
          {(() => {
            const diff = sumTimeSec(cnItem) - sumTimeSec(item)
            if (diff === 0) return <span className="diff-same">总时间相同</span>
            const abs = fmtTimeFromSec(Math.abs(diff))
            return diff > 0
              ? <span className="diff-positive">国服多: +{abs}</span>
              : <span className="diff-negative">国服少: {abs}</span>
          })()}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {columns.map((col, i) => <th key={i}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {levels.map(level => {
                const lvInt = item.levels[level]
                const lvCn = cnItem.levels[level]
                if (!lvInt) return null
                const diff = isDifferent(item, cnItem, level, gp)
                const intCost = applyCost(lvInt.upgradeCost, gp)
                const cnCost = applyCost(lvCn?.upgradeCost, gp)
                const intTime = applyTime(lvInt.upgradeTime, gp)
                const cnTime = applyTime(lvCn?.upgradeTime, gp)
                return (
                  <tr key={level} className={diff ? 'row-diff' : ''}>
                    <td>{level}</td>
                    <td>{lvInt.townHallLevel}</td>
                    <td className={diff && intCost !== cnCost ? 'diff-cell' : ''}>
                      {vs(formatCost(intCost), formatCost(cnCost))}
                    </td>
                    <td className={diff && intTime !== cnTime ? 'diff-cell' : ''}>
                      {vs(intTime || '-', cnTime || '-')}
                    </td>
                    <td className={diff && lvInt.dps !== lvCn?.dps ? 'diff-cell' : ''}>
                      {lvInt.dps === lvCn?.dps ? lvInt.dps : vs(lvInt.dps ?? '-', lvCn?.dps ?? '-')}
                    </td>
                    <td className={diff && lvInt.hp !== lvCn?.hp ? 'diff-cell' : ''}>
                      {lvInt.hp === lvCn?.hp ? lvInt.hp : vs(lvInt.hp ?? '-', lvCn?.hp ?? '-')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
