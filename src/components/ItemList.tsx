import { useState } from 'react'
import { UpgradeItem } from '../types'

interface Props {
  items: UpgradeItem[]
  onSelect: (item: UpgradeItem) => void
}

const BASE = 'https://static.clashpost.com/upgrade'

function itemImgUrl(item: UpgradeItem): string | null {
  if (!item.imgFolder || !item.imgSrc) return null
  return `${BASE}/${item.imgFolder}/${item.imgSrc}`
}

export default function ItemList({ items, onSelect }: Props) {
  return (
    <div className="item-list">
      {items.map(item => (
        <ItemCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </div>
  )
}

function ItemCard({ item, onSelect }: { item: UpgradeItem; onSelect: (item: UpgradeItem) => void }) {
  const [imgErr, setImgErr] = useState(false)
  const url = itemImgUrl(item)
  const showImg = url && !imgErr
  return (
    <div className="item-card" onClick={() => onSelect(item)}>
      {showImg && (
        <div className="item-card-img">
          <img src={url!} alt={item.name} referrerPolicy="no-referrer" onError={() => setImgErr(true)} />
        </div>
      )}
      <div className="item-card-name">{item.nameCn}</div>
    </div>
  )
}
