import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

interface LevelInfo {
  name: string
  description: string | null
  recommendation: string | null
}

interface OverallResult {
  total_questions: number
  correct_count: number
  incorrect_count: number
  points_earned: number
  points_possible: number
  percentage: number
  level: LevelInfo | null
}

interface BreakdownRow {
  breakdown_type: 'module' | 'category' | 'chapter' | 'lesson' | 'skill' | 'difficulty'
  breakdown_label: string
  total_questions: number
  correct_count: number
  percentage: number
  classification: 'strong' | 'weak' | 'average' | null
}

const SECTION_TITLES: Record<BreakdownRow['breakdown_type'], string> = {
  module: 'By Module',
  category: 'By Category',
  chapter: 'By Chapter',
  lesson: 'By Lesson',
  skill: 'By Skill',
  difficulty: 'By Difficulty',
}

const SECTION_ORDER: BreakdownRow['breakdown_type'][] = [
  'module',
  'category',
  'chapter',
  'lesson',
  'skill',
  'difficulty',
]

function classificationStyles(classification: BreakdownRow['classification']) {
  switch (classification) {
    case 'strong':
      return 'bg-green-100 text-green-700'
    case 'weak':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export default function AdminAttemptDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>()

  const [overall, setOverall] = useState<OverallResult | null>(null)
  const [breakdowns, setBreakdowns] = useState<BreakdownRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  async function fetchData() {
    if (!attemptId) return
    setLoading(true)

    const { data: resultData, error: resultError } = await supabase
      .from('attempt_results')
      .select(
        `
        total_questions, correct_count, incorrect_count,
        points_earned, points_possible, percentage,
        level:levels ( name, description, recommendation )
      `
      )
      .eq('attempt_id', attemptId)
      .single()

    if (resultError || !resultData) {
      setError('Results not available for this attempt yet.')
      setLoading(false)
      return
    }

    setOverall(resultData as unknown as OverallResult)

    const { data: breakdownData } = await supabase
      .from('attempt_breakdowns')
      .select('breakdown_type, breakdown_label, total_questions, correct_count, percentage, classification')
      .eq('attempt_id', attemptId)
      .order('breakdown_type')
      .order('breakdown_label')

    setBreakdowns(breakdownData ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading...</p>
      </div>
    )
  }

  if (error || !overall) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  const sections = SECTION_ORDER.map((type) => ({
    type,
    rows: breakdowns.filter((b) => b.breakdown_type === type),
  })).filter((s) => s.rows.length > 0)

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link to="/admin/assessments" className="text-sm text-blue-600 hover:underline">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1">Attempt Results</h1>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <section className="bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-sm text-slate-500 mb-1">Overall Score</p>
          <p className="text-5xl font-bold text-slate-900 mb-2">{overall.percentage}%</p>
          <p className="text-slate-600 mb-6">
            {overall.correct_count} of {overall.total_questions} correct &middot;{' '}
            {overall.points_earned} / {overall.points_possible} points
          </p>

          {overall.level && (
            <div className="inline-block bg-blue-50 border border-blue-100 rounded-lg px-6 py-4 text-left max-w-md">
              <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-1">
                Level: {overall.level.name}
              </p>
              {overall.level.description && (
                <p className="text-sm text-slate-700 mb-2">{overall.level.description}</p>
              )}
              {overall.level.recommendation && (
                <p className="text-sm text-slate-600 italic">{overall.level.recommendation}</p>
              )}
            </div>
          )}
        </section>

        {sections.map(({ type, rows }) => (
          <section key={type} className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">{SECTION_TITLES[type]}</h2>
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={`${type}-${row.breakdown_label}`}
                  className="flex items-center justify-between border-b border-slate-100 last:border-0 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{row.breakdown_label}</p>
                    <p className="text-xs text-slate-500">
                      {row.correct_count} / {row.total_questions} correct
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">{row.percentage}%</span>
                    {row.classification && (
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${classificationStyles(
                          row.classification
                        )}`}
                      >
                        {row.classification}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}