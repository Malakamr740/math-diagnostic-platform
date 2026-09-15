import type { BreakdownRow, TaxonomyType } from './Types'

const TYPE_ORDER: TaxonomyType[] = ['module', 'category', 'chapter', 'lesson', 'skill', 'difficulty']
const TYPE_LABELS: Record<TaxonomyType, string> = {
  module: 'Modules',
  category: 'Categories',
  chapter: 'Chapters',
  lesson: 'Lessons',
  skill: 'Skills',
  difficulty: 'Difficulty',
}

interface Props {
  breakdowns: BreakdownRow[]
  onSelect?: (type: TaxonomyType, label: string) => void
  activeFilter?: { type: TaxonomyType; label: string } | null
}

export default function TaxonomyTree({ breakdowns, onSelect, activeFilter }: Props) {
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    rows: breakdowns.filter((b) => b.type === type),
  })).filter((g) => g.rows.length > 0)

  if (grouped.length === 0) return null

  return (
    <div className="space-y-4">
      {grouped.map(({ type, rows }) => (
        <div key={type} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{TYPE_LABELS[type]}</h3>
          <div className="mt-3 space-y-2">
            {rows.map((row) => {
              const isActive = activeFilter?.type === type && activeFilter.label === row.label
              return (
                <button
                  key={`${type}-${row.id ?? row.label}`}
                  onClick={() => onSelect?.(type, row.label)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-900">{row.label}</span>
                    <span className="text-xs font-semibold text-slate-600">{row.percentage}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${row.percentage}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {row.correct_count}/{row.total_questions} correct
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
