import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ContentBlockRenderer, { type ContentBlock } from '../components/ContentBlockRenderer'

interface ModuleInfo {
  id: string
  name: string
  assessment_id: string
}

interface QuestionRow {
  id: string
  content_blocks: ContentBlock[]
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  status: 'draft' | 'published' | 'archived'
}

interface ModuleQuestionRow {
  id: string // module_questions row id
  question_id: string
  display_order: number
  points_override: number | null
  required: boolean
  question: QuestionRow
}

export default function ModuleQuestionsPage() {
  const { assessmentId, moduleId } = useParams<{ assessmentId: string; moduleId: string }>()

  const [module, setModule] = useState<ModuleInfo | null>(null)
  const [assignedQuestions, setAssignedQuestions] = useState<ModuleQuestionRow[]>([])
  const [availableQuestions, setAvailableQuestions] = useState<QuestionRow[]>([])
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [moduleId])

  async function fetchData() {
    if (!moduleId) return
    setLoading(true)

    const [{ data: moduleData, error: mError }, { data: assignedData, error: aqError }, { data: allQuestions }] =
      await Promise.all([
        supabase.from('modules').select('id, name, assessment_id').eq('id', moduleId).single(),
        supabase
          .from('module_questions')
          .select(
            'id, question_id, display_order, points_override, required, question:questions(id, content_blocks, difficulty, points, status)'
          )
          .eq('module_id', moduleId)
          .order('display_order'),
        supabase
          .from('questions')
          .select('id, content_blocks, difficulty, points, status')
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
      ])

    if (mError || !moduleData) {
      setError('Could not load this module.')
      setLoading(false)
      return
    }

    setModule(moduleData)
    setAssignedQuestions((assignedData ?? []) as unknown as ModuleQuestionRow[])
    setAvailableQuestions(allQuestions ?? [])
    setLoading(false)

    if (aqError) setError(aqError.message)
  }

  const assignedQuestionIds = new Set(assignedQuestions.map((mq) => mq.question_id))

  const filteredAvailable = availableQuestions.filter((q) => {
    if (assignedQuestionIds.has(q.id)) return false // already added, don't show twice
    if (!searchText.trim()) return true
    // Simple text search across the question's text blocks
    const textContent = q.content_blocks
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.value : ''))
      .join(' ')
      .toLowerCase()
    return textContent.includes(searchText.toLowerCase())
  })

  async function addQuestion(questionId: string) {
    setAddingId(questionId)

    const { error: insertError } = await supabase.from('module_questions').insert({
      module_id: moduleId,
      question_id: questionId,
      display_order: assignedQuestions.length,
      required: true,
    })

    setAddingId(null)

    if (insertError) {
      setError(insertError.message)
      return
    }

    fetchData()
  }

  async function removeQuestion(moduleQuestionId: string) {
    await supabase.from('module_questions').delete().eq('id', moduleQuestionId)
    fetchData()
  }

  async function moveQuestion(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= assignedQuestions.length) return

    const a = assignedQuestions[index]
    const b = assignedQuestions[newIndex]

    await Promise.all([
      supabase.from('module_questions').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('module_questions').update({ display_order: a.display_order }).eq('id', b.id),
    ])

    fetchData()
  }

  async function updatePointsOverride(moduleQuestionId: string, value: string) {
    const numeric = value.trim() === '' ? null : Number(value)
    await supabase
      .from('module_questions')
      .update({ points_override: numeric })
      .eq('id', moduleQuestionId)
    fetchData()
  }

  async function updateRequired(moduleQuestionId: string, required: boolean) {
    const { error: updateError } = await supabase.from('module_questions').update({ required }).eq('id', moduleQuestionId)
    if (updateError) setError(updateError.message)
    else fetchData()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading...</p>
      </div>
    )
  }

  if (!module) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-red-600">Module not found.</p>
      </div>
    )
  }

  const totalPoints = assignedQuestions.reduce(
    (sum, mq) => sum + (mq.points_override ?? mq.question.points),
    0
  )

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link to={`/admin/assessments/${assessmentId}`} className="text-sm text-blue-600 hover:underline">
          ← Back to Assessment
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1">{module.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {assignedQuestions.length} question{assignedQuestions.length === 1 ? '' : 's'} ·{' '}
          {totalPoints} total point{totalPoints === 1 ? '' : 's'}
        </p>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto mt-4 px-6">
          <p className="text-red-600 bg-red-50 rounded-md px-4 py-3">{error}</p>
        </div>
      )}

      <main className="p-6 max-w-6xl mx-auto grid grid-cols-2 gap-6">
        {/* LEFT: Questions in this module */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">In This Module</h2>

          {assignedQuestions.length === 0 && (
            <p className="text-slate-500 bg-white rounded-lg border border-slate-200 p-6 text-center text-sm">
              No questions added yet. Add some from the question bank on the right.
            </p>
          )}

          <div className="space-y-2">
            {assignedQuestions.map((mq, index) => (
              <div
                key={mq.id}
                className="bg-white rounded-lg shadow-sm p-3 border border-slate-200"
              >
                <div className="text-sm text-slate-900 mb-2">
                  <ContentBlockRenderer blocks={mq.question.content_blocks} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="bg-slate-100 px-2 py-1 rounded">{mq.question.difficulty}</span>
                    <label className="flex items-center gap-1">
                      Points:
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        defaultValue={mq.points_override ?? mq.question.points}
                        onBlur={(e) => updatePointsOverride(mq.id, e.target.value)}
                        className="w-14 rounded border border-slate-300 px-1 py-0.5"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={mq.required} onChange={(event) => updateRequired(mq.id, event.target.checked)} />
                      Required
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveQuestion(index, -1)}
                      disabled={index === 0}
                      className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveQuestion(index, 1)}
                      disabled={index === assignedQuestions.length - 1}
                      className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeQuestion(mq.id)}
                      className="px-2 py-0.5 rounded bg-red-50 text-red-700 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Question bank browser */}
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Question Bank</h2>

          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search questions..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 mb-3 text-sm"
          />

          <p className="text-xs text-slate-400 mb-2">
            Showing published questions only. {filteredAvailable.length} available.
          </p>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredAvailable.map((q) => (
              <div key={q.id} className="bg-white rounded-lg shadow-sm p-3 border border-slate-200">
                <div className="text-sm text-slate-900 mb-2">
                  <ContentBlockRenderer blocks={q.content_blocks} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-2 text-slate-500">
                    <span className="bg-slate-100 px-2 py-1 rounded">{q.difficulty}</span>
                    <span className="bg-slate-100 px-2 py-1 rounded">{q.points} pt(s)</span>
                  </div>
                  <button
                    onClick={() => addQuestion(q.id)}
                    disabled={addingId === q.id}
                    className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingId === q.id ? 'Adding...' : '+ Add'}
                  </button>
                </div>
              </div>
            ))}

            {filteredAvailable.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-6">
                No matching questions found.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
