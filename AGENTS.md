# Project Knowledge

## Goal
Build a website to display Clash of Clans upgrade data comparing international vs China servers in same-column "int vs cn" format.

## Data Source
clashpost.com/upgrade — Chinese site with Chinese names. Source repo: github.com/lemonicy/clashpost (VitePress, Markdown files in docs/upgrade/).

## Data Files
- Location: `src/data/json/intl/` and `src/data/json/cn/` (grouped by category folder)
- Format: JSON per item, e.g. `barbarian.json` with `{id, name, nameCn, category, village, maxLevel, levels[]}`
- `cn/` mirrors `intl/` — manually patch differences

## Categories
troops, heroes, spells, siege, pets, traps, walls, buildings, equipment

## Villages
home, builder

## Scrapers
- `scripts/scrape-intl.ts` — fetches from clashpost GitHub, parses Markdown → `intl/`
- `scripts/scrape-cn.ts` — copies `intl/` → `cn/` (manual patching after)
Run: `npx tsx scripts/scrape-intl.ts && npx tsx scripts/scrape-cn.ts`

## Known Issues
- 7 items have no standard upgrade table (Giga-Tesla, Giga-Inferno, Crafting-Station, B.O.B's Hut, Helper Hut, BH Army Camp, BH Reinforcement Camp)
- Builder base items prefixed with `bh-` to avoid ID collisions

## Types
- `UpgradeItem`: {id, name, nameCn, category, village, maxLevel, levels}
- `LevelData`: {level, upgradeCost?, upgradeTime?, townHallLevel?, dps?, hp?, [key]: any}
