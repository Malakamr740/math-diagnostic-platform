import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ContentTextEditor from '../components/ContentTextEditor'
import ChoicesTextEditor, { type Choice } from '../components/ChoicesTextEditor'
import type { ContentBlock } from '../lib/contentBlocks'
import TrueFalseAnswerEditor from '../components/TrueFalseAnswerEditor'
import GridInAnswerEditor from '../components/GridInAnswerEditor'
import TaxonomySelector, { type TaxonomySelection } from '../components/TaxonomySelector'

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
  const [taxonomy, setTaxonomy] = useState<TaxonomySelection>({ exam_id: '', subject_id: '', category_id: '', chapter_id: '', lesson_id: '', skill_id: '' })
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [initialChoices, setInitialChoices] = useState<Choice[]>([])
  const [choices, setChoices] = useState<Choice[]>([])
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<boolean | null>(null)
  const [gridInAnswer, setGridInAnswer] = useState<{ value: string; tolerance: string }>({
    value: '',
    tolerance: '',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!questionId) return

      const [{ data: types }, { data: question, error: qError }, { data: existingChoices }, { data: existingAnswer }] =
        await Promise.all([
          supabase.from('answer_types').select('id, code, label'),
          supabase
            .from('questions')
            .select('content_blocks, answer_type_id, difficulty, points, status, exam_id, subject_id, category_id, chapter_id, lesson_id, skill_id')
            .eq('id', questionId)
            .single(),
          supabase
            .from('question_choices')
            .select('id, content_blocks, is_correct, display_order')
            .eq('question_id', questionId)
            .order('display_order'),
          supabase
            .from('question_correct_answers')
            .select('answer_data')
            .eq('question_id', questionId)
            .maybeSingle(),
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
      setTaxonomy({
        exam_id: question.exam_id ?? '', subject_id: question.subject_id ?? '', category_id: question.category_id ?? '',
        chapter_id: question.chapter_id ?? '', lesson_id: question.lesson_id ?? '', skill_id: question.skill_id ?? '',
      })

      const loadedChoices = (existingChoices ?? []).map((c) => ({
        content_blocks: c.content_blocks,
        is_correct: c.is_correct,
      }))
      setInitialChoices(loadedChoices)
      setChoices(loadedChoices)

      if (existingAnswer?.answer_data) {
        const data = existingAnswer.answer_data as { value?: unknown; tolerance?: unknown }
        if (typeof data.value === 'boolean') {
          setTrueFalseAnswer(data.value)
        } else if (typeof data.value === 'number') {
          setGridInAnswer({
            value: String(data.value),
            tolerance: data.tolerance !== undefined ? String(data.tolerance) : '',
          })
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [questionId])

  const selectedAnswerType = answerTypes.find((t) => t.id === answerTypeId)
  const isMCQ = selectedAnswerType?.code === 'MCQ'
  const isTrueFalse = selectedAnswerType?.code === 'TRUE_FALSE'
  const isGridIn = selectedAnswerType?.code === 'GRID_IN'

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
    if (isTrueFalse && trueFalseAnswer === null) {
      setError('Select the correct answer (True or False).')
      return
    }
    if (isGridIn && gridInAnswer.value.trim() === '') {
      setError('Enter the correct numeric answer.')
      return
    }

    setSaving(true)

    const { error: updateError } = await supabase
      .from('questions')
      .update({
        content_blocks: contentBlocks,
        answer_type_id: answerTypeId,
        difficulty,
        points,
        exam_id: taxonomy.exam_id || null,
        subject_id: taxonomy.subject_id || null,
        category_id: taxonomy.category_id || null,
        chapter_id: taxonomy.chapter_id || null,
        lesson_id: taxonomy.lesson_id || null,
        skill_id: taxonomy.skill_id || null,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Always remove old choices and old correct-answer row first — the
    // answer type may have changed, so whichever table applied before
    // might not apply anymore.
    const { error: deleteChoicesError } = await supabase
      .from('question_choices')
      .delete()
      .eq('question_id', questionId)

    if (deleteChoicesError) {
      setError(`Question was updated, but old choices could not be removed: ${deleteChoicesError.message}`)
      setSaving(false)
      return
    }

    const { error: deleteAnswerError } = await supabase
      .from('question_correct_answers')
      .delete()
      .eq('question_id', questionId)

    if (deleteAnswerError) {
      setError(`Question was updated, but old correct answer could not be removed: ${deleteAnswerError.message}`)
      setSaving(false)
      return
    }

    if (isMCQ) {
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

    if (isTrueFalse) {
      const { error: answerError } = await supabase.from('question_correct_answers').insert({
        question_id: questionId,
        answer_data: { value: trueFalseAnswer },
      })
      if (answerError) {
        setError(`Question saved, but correct answer failed to update: ${answerError.message}`)
        setSaving(false)
        return
      }
    }

    if (isGridIn) {
      const { error: answerError } = await supabase.from('question_correct_answers').insert({
        question_id: questionId,
        answer_data: {
          value: parseFloat(gridInAnswer.value),
          tolerance: gridInAnswer.tolerance ? parseFloat(gridInAnswer.tolerance) : 0,
        },
      })
      if (answerError) {
        setError(`Question saved, but correct answer failed to update: ${answerError.message}`)
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

          {isMCQ && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Answer Choices
              </label>
              <ChoicesTextEditor initialChoices={initialChoices} onChange={setChoices} />
            </div>
          )}

          {isTrueFalse && (
            <TrueFalseAnswerEditor value={trueFalseAnswer} onChange={setTrueFalseAnswer} />
          )}

          {isGridIn && (
            <GridInAnswerEditor value={gridInAnswer} onChange={setGridInAnswer} />
          )}

          <div className="grid grid-cols-3 gap-4">
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

          <TaxonomySelector value={taxonomy} onChange={setTaxonomy} />

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
