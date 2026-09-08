import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '../lib/supabaseClient'
import ContentBlockRenderer, {
  type ContentBlock,
} from '../components/ContentBlockRenderer'
import { useAuth } from '../contexts/AuthContext'

interface QuestionRow {
  id: string
  content_blocks: ContentBlock[]
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
  status: 'draft' | 'published' | 'archived'
  created_at: string
}

export default function QuestionBankPage() {
  const { profile, session, signOut } = useAuth()

  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Question currently waiting for delete confirmation
  const [questionToDelete, setQuestionToDelete] =
    useState<QuestionRow | null>(null)

  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function fetchQuestions() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('questions')
      .select(
        'id, content_blocks, difficulty, points, status, created_at'
      )
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setQuestions((data ?? []) as QuestionRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchQuestions()
  }, [])

  function openDeleteConfirmation(question: QuestionRow) {
    setDeleteError(null)
    setQuestionToDelete(question)
  }

  function closeDeleteConfirmation() {
    if (deleting) return

    setQuestionToDelete(null)
    setDeleteError(null)
  }

  async function permanentlyDeleteQuestion() {
    if (!questionToDelete) return

    setDeleting(true)
    setDeleteError(null)

    try {
      const questionId = questionToDelete.id

      /*
       * First delete choices belonging to the question.
       *
       * This is important if the database foreign key does not use
       * ON DELETE CASCADE.
       */
      const { error: choicesError } = await supabase
        .from('question_choices')
        .delete()
        .eq('question_id', questionId)

      if (choicesError) {
        setDeleteError(
          `Could not delete the question's choices: ${choicesError.message}`
        )
        setDeleting(false)
        return
      }

      /*
       * Now permanently delete the question itself.
       */
      const { error: questionError } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)

      if (questionError) {
        setDeleteError(
          `Could not delete the question: ${questionError.message}`
        )
        setDeleting(false)
        return
      }

      /*
       * Remove it immediately from the displayed list.
       */
      setQuestions((current) =>
        current.filter((question) => question.id !== questionId)
      )

      setQuestionToDelete(null)
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while deleting the question.'
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-slate-800">
            Question Bank
          </h1>

          <Link
            to="/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Dashboard
          </Link>

          <Link
            to="/admin/questions/new"
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
          >
            + Create Question
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {profile?.full_name || session?.user.email} ({profile?.role})
          </span>

          <button
            onClick={signOut}
            className="text-sm bg-slate-800 text-white px-3 py-1.5 rounded-md hover:bg-slate-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {loading && (
          <p className="text-slate-600">
            Loading questions...
          </p>
        )}

        {error && (
          <p className="text-red-600 bg-red-50 rounded-md px-4 py-3">
            Error: {error}
          </p>
        )}

        {!loading && !error && questions.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600 mb-4">
              No questions yet.
            </p>

            <Link
              to="/admin/questions/new"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              + Create Question
            </Link>
          </div>
        )}

        {!loading && !error && questions.length > 0 && (
          <div className="space-y-3">
            {questions.map((q) => (
              <div
                key={q.id}
                className="bg-white rounded-lg shadow-sm p-4 border border-slate-200"
              >
                {/* Question content */}
                <div className="text-lg text-slate-900 mb-3">
                  <ContentBlockRenderer
                    blocks={q.content_blocks}
                  />
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-4">
                  <span className="bg-slate-100 px-2 py-1 rounded">
                    {q.difficulty}
                  </span>

                  <span className="bg-slate-100 px-2 py-1 rounded">
                    {q.points} pt(s)
                  </span>

                  <span className="bg-slate-100 px-2 py-1 rounded">
                    {q.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                  <Link
                    to={`/admin/questions/${q.id}/edit`}
                    className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100"
                  >
                    ✏️ Edit
                  </Link>

                  <button
                    type="button"
                    onClick={() => openDeleteConfirmation(q)}
                    className="text-sm bg-red-50 text-red-700 px-3 py-1.5 rounded-md hover:bg-red-100"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {questionToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-question-title"
        >
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-lg">
                  🗑️
                </span>
              </div>

              <div>
                <h2
                  id="delete-question-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Delete Question?
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Are you sure you want to permanently delete this
                  question?
                </p>

                <p className="mt-1 text-sm font-medium text-red-600">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Small question preview */}
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-md p-3 max-h-32 overflow-auto">
              <div className="text-sm text-slate-700">
                <ContentBlockRenderer
                  blocks={questionToDelete.content_blocks}
                />
              </div>
            </div>

            {deleteError && (
              <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={permanentlyDeleteQuestion}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting
                  ? 'Deleting...'
                  : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}