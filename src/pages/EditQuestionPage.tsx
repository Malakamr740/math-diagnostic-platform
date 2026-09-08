import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ContentTextEditor from '../components/ContentTextEditor'
import ChoicesEditor, { type Choice } from '../components/ChoicesEditor'
import type { ContentBlock } from '../lib/contentBlocks'

interface AnswerType {
  id: string
  code: string
  label: string
}

export default function EditQuestionPage() {
  const { questionId } = useParams<{ questionId: string }>()
  const navigate = useNavigate()

  const [answerTypes, setAnswerTypes] = useState<AnswerType[]>([])
  const [initialBlocks, setInitialBlocks] = useState<ContentBlock[] | null>(null)
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])
  const [answerTypeId, setAnswerTypeId] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [points, setPoints] = useState(1)
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [choices, setChoices] = useState<Choice[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!questionId) return

      const [{ data: types }, { data: question, error: qError }, { data: existingChoices }] =
        await Promise.all([
          supabase.from('answer_types').select('id, code, label'),
          supabase
            .from('questions')
            .select('content_blocks, answer_type_id, difficulty, points, status')
            .eq('id', questionId)
            .single(),
          supabase
            .from('question_choices')
            .select('id, content_blocks, is_correct, display_order')
            .eq('question_id', questionId)
            .order('display_order'),
        ])

      if (qError || !question) {
        setError('Could not load this question. It may not exist or you may not have access.')
        setLoading(false)
        return
      }

      setAnswerTypes(types ?? [])
      setInitialBlocks(question.content_blocks)
      setContentBlocks(question.content_blocks)
      setAnswerTypeId(question.answer_type_id)
      setDifficulty(question.difficulty)
      setPoints(question.points)
      setStatus(question.status)

      if (existingChoices) {
        setChoices(
          existingChoices.map((c) => ({
            content_blocks: c.content_blocks,
            is_correct: c.is_correct,
          }))
        )
      }

      setLoading(false)
    }

    fetchData()
  }, [questionId])

  const selectedAnswerType = answerTypes.find((t) => t.id === answerTypeId)
  const isMCQ = selectedAnswerType?.code === 'MCQ'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (contentBlocks.length === 0) {
      setError('Question content cannot be empty.')
      return
    }
    if (isMCQ) {
      if (choices.length < 2) {
        setError('MCQ questions need at least 2 choices.')
        return
      }
      if (!choices.some((c) => c.is_correct)) {
        setError('Select which choice is correct.')
        return
      }
    }

    setSaving(true)

    const { error: updateError } = await supabase
      .from('questions')
      .update({
        content_blocks: contentBlocks,
        answer_type_id: answerTypeId,
        difficulty,
        points,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    if (isMCQ) {
      // Simplest correct approach: delete existing choices and re-insert
      // the current set. This avoids tricky "diff old vs new choices"
      // logic (matching which choice is which, handling removed/added
      // choices) — a good tradeoff for now since choices have no other
      // table referencing them yet. We'll revisit this only if a future
      // feature (e.g. per-choice analytics) needs stable choice IDs
      // across edits.
      await supabase.from('question_choices').delete().eq('question_id', questionId)

      const choiceRows = choices.map((choice, index) => ({
        question_id: questionId,
        content_blocks: choice.content_blocks,
        is_correct: choice.is_correct,
        display_order: index,
      }))

      const { error: choicesError } = await supabase.from('question_choices').insert(choiceRows)

      if (choicesError) {
        setError(`Question saved, but choices failed to update: ${choicesError.message}`)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/admin/questions')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading question...</p>
      </div>
    )
  }

  if (error && !initialBlocks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-red-600 bg-red-50 rounded-md px-4 py-3">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link to="/admin/questions" className="text-sm text-blue-600 hover:underline">
          ← Back to Question Bank
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1">Edit Question</h1>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Question Content
            </label>
            <ContentTextEditor initialBlocks={initialBlocks ?? []} onChange={setContentBlocks} />
          </div>

          {isMCQ && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Answer Choices
              </label>
              <ChoicesEditor choices={choices} onChange={setChoices} />
            </div>
          )}

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Answer Type</label>
              <select
                value={answerTypeId}
                onChange={(e) => setAnswerTypeId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {answerTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Points</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </main>
    </div>
  )
}