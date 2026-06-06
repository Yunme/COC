import { useState } from 'react'
import { Village, UpgradeItem } from './types'
import { internationalData, getItemsByVillage, getItemsByCategory, findItem } from './data'
import CategoryTabs from './components/CategoryTabs'
import ItemList from './components/ItemList'
import ItemDetail from './components/ItemDetail'
import './App.css'

const homeCategories = ['troops', 'heroes', 'equipment', 'spells', 'buildings', 'siege', 'pets', 'traps', 'walls']
const builderCategories = ['troops', 'heroes', 'buildings', 'traps', 'walls']

export default function App() {
  const [village, setVillage] = useState<Village>('home')
  const [category, setCategory] = useState<string>('troops')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const villageItems = getItemsByVillage(internationalData, village)
  const categories = village === 'home' ? homeCategories : builderCategories
  const categoryItems = getItemsByCategory(villageItems, category)
  const selectedItem = selectedItemId ? findItem(internationalData, selectedItemId) : null

  return (
    <div className="app">
      <header className="app-header">
        <h1>部落冲突 数据对比</h1>
        <p className="subtitle">国际服 vs 国服 — 升级数据对比查看</p>
      </header>

      {selectedItem ? (
        <ItemDetail item={selectedItem} onBack={() => setSelectedItemId(null)} />
      ) : (
        <>
          <div className="main-tabs">
            <button
              className={village === 'home' ? 'main-tab-active' : ''}
              onClick={() => { setVillage('home'); setCategory('troops') }}
            >
              家乡
            </button>
            <button
              className={village === 'builder' ? 'main-tab-active' : ''}
              onClick={() => { setVillage('builder'); setCategory('troops') }}
            >
              夜世界
            </button>
          </div>
          <CategoryTabs
            categories={categories}
            active={category}
            onChange={setCategory}
          />
          <main>
            <ItemList items={categoryItems} onSelect={(item: UpgradeItem) => setSelectedItemId(item.id)} />
          </main>
        </>
      )}
    </div>
  )
}
