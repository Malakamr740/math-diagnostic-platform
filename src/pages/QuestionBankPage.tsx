import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import ImportQuestionsModal from '../components/ImportQuestionsModal'
import ContentBlockRenderer, { type ContentBlock } from '../components/ContentBlockRenderer'
import { supabase } from '../lib/supabaseClient'

interface TaxonomyNode {
  id: string
  name: string
}

interface QuestionRow {
  id: string
  content_blocks: ContentBlock[]
  explanation_blocks?: ContentBlock[]
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  status: 'draft' | 'published' | 'archived'
  created_at: string
  category_id: string | null
  chapter_id: string | null
  lesson_id: string | null
  skill_id: string | null
  category: TaxonomyNode | null
  chapter: TaxonomyNode | null
  lesson: TaxonomyNode | null
  skill: TaxonomyNode | null
  answer_type: { code: string; label: string } | null
}

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)

  // Taxonomy dropdown options
  const [categories, setCategories] = useState<TaxonomyNode[]>([])
  const [chapters, setChapters] = useState<TaxonomyNode[]>([])
  const [lessons, setLessons] = useState<TaxonomyNode[]>([])

  // Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedChapter, setSelectedChapter] = useState('')
  const [selectedLesson, setSelectedLesson] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('')
  const [selectedAnswerType, setSelectedAnswerType] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

  const [showImportModal, setShowImportModal] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<QuestionRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const [
      { data: qData },
      { data: catData },
      { data: chapData },
      { data: lessData },
    ] = await Promise.all([
      supabase
        .from('questions')
        .select(
          `
          id, content_blocks, explanation_blocks, difficulty, points, status, created_at,
          category_id, chapter_id, lesson_id, skill_id,
          category:categories(id, name),
          chapter:chapters(id, name),
          lesson:lessons(id, name),
          skill:skills(id, name),
          answer_type:answer_types(code, label)
        `
        )
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('chapters').select('id, name').order('name'),
      supabase.from('lessons').select('id, name').order('name'),
    ])

    setQuestions((qData as unknown as QuestionRow[]) ?? [])
    setCategories(catData ?? [])
    setChapters(chapData ?? [])
    setLessons(lessData ?? [])
    setLoading(false)
  }

  // Text search helper
  function extractText(blocks: ContentBlock[] = []): string {
    return blocks
      .map((b) => (b.type === 'text' ? b.value : b.type === 'math' ? b.latex : ''))
      .join(' ')
      .toLowerCase()
  }

  // Filtered Questions Memo
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // 1. Text Search (question prompt + solution)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const questionText = extractText(q.content_blocks)
        const explanationText = extractText(q.explanation_blocks)
        const skillName = q.skill?.name?.toLowerCase() || ''
        const lessonName = q.lesson?.name?.toLowerCase() || ''

        const match =
          questionText.includes(query) ||
          explanationText.includes(query) ||
          skillName.includes(query) ||
          lessonName.includes(query)

        if (!match) return false
      }

      // 2. Category / Domain Filter
      if (selectedCategory && q.category?.id !== selectedCategory) {
        return false
      }

      // 3. Chapter Filter
      if (selectedChapter && q.chapter?.id !== selectedChapter) {
        return false
      }

      // 4. Lesson Filter
      if (selectedLesson && q.lesson?.id !== selectedLesson) {
        return false
      }

      // 5. Difficulty Filter
      if (selectedDifficulty && q.difficulty !== selectedDifficulty) {
        return false
      }

      // 6. Answer Type Filter
      if (selectedAnswerType && q.answer_type?.code !== selectedAnswerType) {
        return false
      }

      // 7. Status Filter
      if (selectedStatus && q.status !== selectedStatus) {
        return false
      }

      return true
    })
  }, [
    questions,
    searchQuery,
    selectedCategory,
    selectedChapter,
    selectedLesson,
    selectedDifficulty,
    selectedAnswerType,
    selectedStatus,
  ])

  function clearAllFilters() {
    setSearchQuery('')
    setSelectedCategory('')
    setSelectedChapter('')
    setSelectedLesson('')
    setSelectedDifficulty('')
    setSelectedAnswerType('')
    setSelectedStatus('')
  }

  const activeFilterCount = [
    searchQuery,
    selectedCategory,
    selectedChapter,
    selectedLesson,
    selectedDifficulty,
    selectedAnswerType,
    selectedStatus,
  ].filter(Boolean).length

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
      title="Question Bank"
      subtitle="Manage, filter, and organize your diagnostic questions by taxonomy and domain"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5"
          >
            <span>📥</span> Bulk Import JSON
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
        {/* ========================================================= */}
        {/* Filter & Search Bar Card */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search questions by keyword, formula, or skill name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-rose-600 hover:underline font-semibold shrink-0"
              >
                Reset All Filters ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1 text-xs">
            {/* Domain / Category */}
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

            {/* Chapter */}
            <div>
              <label className="font-semibold text-slate-500 block mb-1">Chapter</label>
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">All Chapters</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lesson */}
            <div>
              <label className="font-semibold text-slate-500 block mb-1">Lesson</label>
              <select
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">All Lessons</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="font-semibold text-slate-500 block mb-1">Difficulty</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">All Levels</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {/* Answer Type */}
            <div>
              <label className="font-semibold text-slate-500 block mb-1">Question Type</label>
              <select
                value={selectedAnswerType}
                onChange={(e) => setSelectedAnswerType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">All Types</option>
                <option value="MCQ">Multiple Choice</option>
                <option value="GRID_IN">Grid-In (Numeric)</option>
                <option value="TRUE_FALSE">True / False</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="font-semibold text-slate-500 block mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Questions List */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong>{filteredQuestions.length}</strong> of {questions.length} questions
          </span>
        </div>

        {loading ? (
          <p className="text-slate-500 text-center py-8">Loading question bank...</p>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <p className="text-slate-600 font-medium">No matching questions found.</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your filter criteria or search keywords.
            </p>
            <button
              onClick={clearAllFilters}
              className="mt-4 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 hover:border-slate-300 transition"
              >
                {/* Taxonomy Breadcrumbs & Badges */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-extrabold text-slate-400">#{idx + 1}</span>
                    {q.category?.name && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded-md">
                        📁 {q.category.name}
                      </span>
                    )}
                    {q.chapter?.name && (
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 font-medium px-2 py-0.5 rounded-md">
                        📖 {q.chapter.name}
                      </span>
                    )}
                    {q.lesson?.name && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 font-medium px-2 py-0.5 rounded-md">
                        📝 {q.lesson.name}
                      </span>
                    )}
                    {q.skill?.name && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-md">
                        🎯 {q.skill.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded capitalize ${
                        q.difficulty === 'hard'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : q.difficulty === 'easy'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {q.difficulty}
                    </span>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                      {q.answer_type?.code || 'MCQ'} &middot; {q.points} pt
                    </span>
                  </div>
                </div>

                {/* Question Content */}
                <div className="text-sm font-medium text-slate-900 leading-relaxed pt-1">
                  <ContentBlockRenderer blocks={q.content_blocks} />
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Created {new Date(q.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/admin/questions/${q.id}/edit`}
                      className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-2.5 py-1 rounded-md"
                    >
                      ✏️ Edit Question & Taxonomy
                    </Link>
                    <button
                      onClick={() => setQuestionToDelete(q)}
                      className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk JSON Import Modal */}
      <ImportQuestionsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={fetchData}
      />

      {/* Delete Confirmation Modal */}
      {questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Delete Question?</h3>
            <p className="text-xs text-slate-600">
              This will permanently remove this question from your question bank.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setQuestionToDelete(null)}
                disabled={deleting}
                className="px-3 py-1.5 text-xs bg-slate-100 rounded-lg text-slate-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={permanentlyDeleteQuestion}
                disabled={deleting}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg font-semibold"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}