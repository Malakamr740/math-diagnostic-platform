import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ContentTextEditor from '../components/ContentTextEditor'
import ChoicesTextEditor, { type Choice } from '../components/ChoicesTextEditor'
import type { ContentBlock } from '../lib/contentBlocks'

interface AnswerType {
  id: string
  code: string
  label: string
}

export default function CreateQuestionPage() {
  const navigate = useNavigate()
  const [answerTypes, setAnswerTypes] = useState<AnswerType[]>([])
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])
  const [answerTypeId, setAnswerTypeId] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [points, setPoints] = useState(1)
  const [choices, setChoices] = useState<Choice[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnswerTypes() {
      const { data, error } = await supabase.from('answer_types').select('id, code, label')
      if (!error && data) {
        setAnswerTypes(data)
        if (data.length > 0) setAnswerTypeId(data[0].id)
      }
    }
    fetchAnswerTypes()
  }, [])

  const selectedAnswerType = answerTypes.find((t) => t.id === answerTypeId)
  const isMCQ = selectedAnswerType?.code === 'MCQ'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (contentBlocks.length === 0) {
      setError('Add question content before saving.')
      return
    }
    if (!answerTypeId) {
      setError('Select an answer type.')
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

    // Get the current user's organization_id from their profile,
    // since questions require it and RLS enforces it must match.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in.')
      setSaving(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profileData) {
      setError('Could not determine your organization.')
      setSaving(false)
      return
    }

    const { data: insertedQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        organization_id: profileData.organization_id,
        answer_type_id: answerTypeId,
        content_blocks: contentBlocks,
        difficulty,
        points,
        status: 'draft',
      })
      .select('id')
      .single()

    if (insertError || !insertedQuestion) {
      setError(insertError?.message || 'Failed to save question.')
      setSaving(false)
      return
    }

    // If this is an MCQ question, save its choices, linked to the new question.
    if (isMCQ) {
      const choiceRows = choices.map((choice, index) => ({
        question_id: insertedQuestion.id,
        content_blocks: choice.content_blocks,
        is_correct: choice.is_correct,
        display_order: index,
      }))

      const { error: choicesError } = await supabase.from('question_choices').insert(choiceRows)

      if (choicesError) {
        setError(`Question saved, but choices failed: ${choicesError.message}`)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/admin/questions')
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link to="/admin/questions" className="text-sm text-blue-600 hover:underline">
          ← Back to Question Bank
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1">Create Question</h1>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Question Content
            </label>
            <ContentTextEditor onChange={setContentBlocks} />
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
              <ChoicesTextEditor onChange={setChoices} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Question'}
          </button>
        </form>
      </main>
    </div>
  )
}