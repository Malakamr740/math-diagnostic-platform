import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabaseClient'

interface LevelRow {
  id: string
  name: string
  min_percentage: number
  max_percentage: number
  description: string | null
  recommendation: string | null
}

export default function LevelsCoursesPage() {
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    fetchLevels()
  }, [])

  async function fetchLevels() {
    setLoading(true)
    const { data } = await supabase
      .from('levels')
      .select('id, name, min_percentage, max_percentage, description, recommendation')
      .order('min_percentage')

    setLevels(data ?? [])
    setLoading(false)
  }

  async function updateLevel(level: LevelRow) {
    setSavingId(level.id)
    await supabase
      .from('levels')
      .update({
        name: level.name,
        description: level.description,
        recommendation: level.recommendation,
      })
      .eq('id', level.id)
    setSavingId(null)
  }

  return (
    <AdminLayout
      title="Performance Levels & Recommendations"
      subtitle="Configure mastery thresholds and feedback text printed on student report cards"
    >
      <div className="max-w-4xl space-y-4">
        {loading ? (
          <p className="text-slate-500">Loading levels...</p>
        ) : (
          levels.map((lvl, index) => (
            <div key={lvl.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={lvl.name}
                    onChange={(e) => {
                      const copy = [...levels]
                      copy[index].name = e.target.value
                      setLevels(copy)
                    }}
                    className="font-bold text-slate-900 border-b border-transparent focus:border-blue-500 px-1 outline-none text-base"
                  />
                </div>
                <span className="text-xs font-mono font-semibold bg-slate-100 px-2.5 py-1 rounded-md text-slate-600">
                  {lvl.min_percentage}% – {lvl.max_percentage}%
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Evaluation Description
                </label>
                <input
                  type="text"
                  value={lvl.description ?? ''}
                  onChange={(e) => {
                    const copy = [...levels]
                    copy[index].description = e.target.value
                    setLevels(copy)
                  }}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Targeted Next Step Recommendation
                </label>
                <textarea
                  rows={2}
                  value={lvl.recommendation ?? ''}
                  onChange={(e) => {
                    const copy = [...levels]
                    copy[index].recommendation = e.target.value
                    setLevels(copy)
                  }}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => updateLevel(lvl)}
                  disabled={savingId === lvl.id}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-md"
                >
                  {savingId === lvl.id ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  )
}