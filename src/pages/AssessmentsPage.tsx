import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

interface AssessmentRow {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'published' | 'archived'
  created_at: string
}

export default function AssessmentsPage() {
  const { profile, session, signOut } = useAuth()
  const [assessments, setAssessments] = useState<AssessmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAssessments()
  }, [])

  async function fetchAssessments() {
    setLoading(true)
    const { data, error } = await supabase
      .from('assessments')
      .select('id, name, description, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setAssessments(data as AssessmentRow[])
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-slate-800">Assessments</h1>
          <Link to="/admin" className="text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
          <Link
            to="/admin/assessments/new"
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700"
          >
            + Create Assessment
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
        {loading && <p className="text-slate-600">Loading assessments...</p>}
        {error && <p className="text-red-600 bg-red-50 rounded-md px-4 py-3">Error: {error}</p>}

        {!loading && !error && assessments.length === 0 && (
          <p className="text-slate-600">No assessments yet. Create your first one above.</p>
        )}

        {!loading && !error && assessments.length > 0 && (
          <div className="space-y-3">
            {assessments.map((a) => (
              <Link
                key={a.id}
                to={`/admin/assessments/${a.id}`}
                className="block bg-white rounded-lg shadow-sm p-4 border border-slate-200 hover:border-blue-300 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-slate-900">{a.name}</h2>
                    {a.description && (
                      <p className="text-sm text-slate-500 mt-1">{a.description}</p>
                    )}
                  </div>
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded">{a.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}