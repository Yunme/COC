import { categoryLabels } from '../data'

interface Props {
  categories: string[]
  active: string
  onChange: (cat: string) => void
}

export default function CategoryTabs({ categories, active, onChange }: Props) {
  return (
    <div className="category-tabs">
      {categories.map(cat => (
        <button
          key={cat}
          className={cat === active ? 'tab-active' : ''}
          onClick={() => onChange(cat)}
        >
          {categoryLabels[cat] || cat}
        </button>
      ))}
    </div>
  )
}
