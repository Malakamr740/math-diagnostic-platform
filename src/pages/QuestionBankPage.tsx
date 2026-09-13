import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import ImportQuestionsModal from '../components/ImportQuestionsModal'
import ContentBlockRenderer, { type ContentBlock } from '../components/ContentBlockRenderer'
import { supabase } from '../lib/supabaseClient'

interface TaxonomyNode {
  id: string
  name: string
}

interface QuestionSet {
  id: string
  title: string
  created_at: string
  questions_count?: number
}

interface QuestionRow {
  id: string
  content_blocks: ContentBlock[]
  explanation_blocks?: ContentBlock[]
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  status: 'draft' | 'published' | 'archived'
  created_at: string
  question_set_id: string | null
  source_item_number: number | null
  category: TaxonomyNode | null
  chapter: TaxonomyNode | null
  lesson: TaxonomyNode | null
  skill: TaxonomyNode | null
  answer_type: { code: string; label: string } | null
}

export default function QuestionBankPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<'sets' | 'all'>('sets')
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [sets, setSets] = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)

  // Taxonomy & Filter State
  const [categories, setCategories] = useState<TaxonomyNode[]>([])
  const [selectedSetFilter, setSelectedSetFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('')
  const [selectedAnswerType, setSelectedAnswerType] = useState('')

  const [showImportModal, setShowImportModal] = useState(false)
  const [convertingSetId, setConvertingSetId] = useState<string | null>(null)
  const [questionToDelete, setQuestionToDelete] = useState<QuestionRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const [
      { data: qData },
      { data: setsData },
      { data: catData }
    ] = await Promise.all([
      supabase
        .from('questions')
        .select(`
          id, content_blocks, explanation_blocks, difficulty, points, status, created_at,
          question_set_id, source_item_number,
          category:categories(id, name),
          chapter:chapters(id, name),
          lesson:lessons(id, name),
          skill:skills(id, name),
          answer_type:answer_types(code, label)
        `)
        .order('source_item_number', { ascending: true, nullsFirst: false }),
      supabase.from('question_sets').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name').order('name'),
    ])

    const loadedQuestions = (qData as unknown as QuestionRow[]) ?? []
    setQuestions(loadedQuestions)
    setCategories(catData ?? [])

    // Calculate count per set
    const setList = (setsData ?? []).map((s) => ({
      ...s,
      questions_count: loadedQuestions.filter((q) => q.question_set_id === s.id).length,
    }))
    setSets(setList)

    setLoading(false)
  }

  function extractText(blocks: ContentBlock[] = []): string {
    return blocks
      .map((b) => (b.type === 'text' ? b.value : b.type === 'math' ? b.latex : ''))
      .join(' ')
      .toLowerCase()
  }

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (selectedSetFilter && q.question_set_id !== selectedSetFilter) return false
      if (selectedCategory && q.category?.id !== selectedCategory) return false
      if (selectedDifficulty && q.difficulty !== selectedDifficulty) return false
      if (selectedAnswerType && q.answer_type?.code !== selectedAnswerType) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const match =
          extractText(q.content_blocks).includes(query) ||
          (q.skill?.name && q.skill.name.toLowerCase().includes(query))
        if (!match) return false
      }
      return true
    })
  }, [questions, selectedSetFilter, selectedCategory, selectedDifficulty, selectedAnswerType, searchQuery])

  async function convertSetToAssessment(setId: string, title: string) {
    if (!confirm(`Create a ready-to-publish assessment from "${title}"?`)) return
    setConvertingSetId(setId)

    const { data: newAssessmentId, error } = await supabase.rpc('convert_question_set_to_assessment', {
      p_set_id: setId,
    })

    setConvertingSetId(null)
    if (error) {
      alert(`Could not create assessment: ${error.message}`)
    } else {
      navigate(`/admin/assessments/${newAssessmentId}`)
    }
  }

  async function permanentlyDeleteQuestion() {
    if (!questionToDelete) return
    setDeleting(true)
    await supabase.from('questions').delete().eq('id', questionToDelete.id)
    setQuestions((prev) => prev.filter((q) => q.id !== questionToDelete.id))
    setQuestionToDelete(null)
    setDeleting(false)
  }

  return (
    <AdminLayout
      title="Question Bank & Test Collections"
      subtitle="Organize items by standardized test papers or browse individual questions"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5"
          >
            <span>📥</span> Bulk Import Test JSON
          </button>
          <Link
            to="/admin/questions/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
          >
            + Create Question
          </Link>
        </div>
      }
    >
      <div className="space-y-5 max-w-6xl">
        {/* View Mode Switcher */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setViewMode('sets')
                setSelectedSetFilter('')
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                viewMode === 'sets'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              📁 Grouped by Test Collections ({sets.length})
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                viewMode === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              📄 All Loose Questions ({questions.length})
            </button>
          </div>

          {selectedSetFilter && (
            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full font-bold">
              Filtered to selected collection
            </span>
          )}
        </div>

        {/* ========================================================= */}
        {/* VIEW MODE 1: TEST COLLECTIONS DIRECTORY */}
        {/* ========================================================= */}
        {viewMode === 'sets' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sets.map((set) => (
              <div
                key={set.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md uppercase">
                      Test Collection
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      {set.questions_count} questions
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-2">{set.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Imported on {new Date(set.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSetFilter(set.id)
                      setViewMode('all')
                    }}
                    className="font-bold text-blue-600 hover:text-blue-800"
                  >
                    View Items ({set.questions_count}) →
                  </button>

                  <button
                    type="button"
                    disabled={convertingSetId === set.id}
                    onClick={() => convertSetToAssessment(set.id, set.title)}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                  >
                    {convertingSetId === set.id ? 'Creating Assessment...' : '🚀 Convert to Assessment'}
                  </button>
                </div>
              </div>
            ))}

            {sets.length === 0 && (
              <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                No grouped test sets yet. Use <strong>"Bulk Import Test JSON"</strong> above to import your first test paper.
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW MODE 2: ITEMIZED QUESTIONS WITH FILTERS */}
        {/* ========================================================= */}
        {viewMode === 'all' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="font-semibold text-slate-500 block mb-1">Test Collection</label>
                <select
                  value={selectedSetFilter}
                  onChange={(e) => setSelectedSetFilter(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white font-medium"
                >
                  <option value="">All Collections</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Domain</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="">All Domains</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Difficulty</label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Search Formula / Skill</label>
                <input
                  type="text"
                  placeholder="Keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
                />
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                        {q.source_item_number || '•'}
                      </span>
                      {q.category && (
                        <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded">
                          📁 {q.category.name}
                        </span>
                      )}
                      {q.skill && (
                        <span className="bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                          🎯 {q.skill.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="capitalize">{q.difficulty}</span> &middot;
                      <span>{q.points} pt</span>
                    </div>
                  </div>

                  <div className="text-sm font-medium text-slate-900 leading-relaxed">
                    <ContentBlockRenderer blocks={q.content_blocks} />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
                    <Link
                      to={`/admin/questions/${q.id}/edit`}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-md"
                    >
                      ✏️ Edit
                    </Link>
                    <button
                      onClick={() => setQuestionToDelete(q)}
                      className="text-rose-600 hover:text-rose-800 px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bulk JSON Import Modal */}
      <ImportQuestionsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={fetchData}
      />

      {/* Delete Question Modal */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Delete Question?</h3>
            <p className="text-xs text-slate-600">This will permanently delete this question from all modules.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setQuestionToDelete(null)} className="px-3 py-1.5 text-xs bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button onClick={permanentlyDeleteQuestion} disabled={deleting} className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded-lg font-bold">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}