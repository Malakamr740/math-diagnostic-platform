import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

interface Exam {
  id: string
  name: string
}

export default function CreateAssessmentPage() {
  const navigate = useNavigate()
  const [exams, setExams] = useState<Exam[]>([])
  const [examId, setExamId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchExams() {
      const { data } = await supabase.from('exams').select('id, name').eq('is_active', true)
      if (data) setExams(data)
    }
    fetchExams()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Assessment name is required.')
      return
    }

    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in.')
      setSaving(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profileData) {
      setError('Could not determine your organization.')
      setSaving(false)
      return
    }

    const { data: inserted, error: insertError } = await supabase
      .from('assessments')
      .insert({
        organization_id: profileData.organization_id,
        exam_id: examId || null,
        name: name.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        status: 'draft',
      })
      .select('id')
      .single()

    setSaving(false)

    if (insertError || !inserted) {
      setError(insertError?.message || 'Failed to create assessment.')
      return
    }

    // Go straight to the new assessment's detail page — that's
    // where modules get added next.
    navigate(`/admin/assessments/${inserted.id}`)
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link to="/admin/assessments" className="text-sm text-blue-600 hover:underline">
          ← Back to Assessments
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1">Create Assessment</h1>
      </header>

      <main className="p-6 max-w-xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SAT Mathematics Diagnostic"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exam (optional)</label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">— None —</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Instructions (shown to students before starting)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Assessment'}
          </button>
        </form>
      </main>
    </div>
  )
}