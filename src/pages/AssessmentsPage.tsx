import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import ShareAssessmentModal from '../components/ShareAssessmentModal'
import { supabase } from '../lib/supabaseClient'

interface AssessmentRow {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'published' | 'archived'
  created_at: string
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<AssessmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [shareTarget, setShareTarget] = useState<AssessmentRow | null>(null)

  useEffect(() => {
    fetchAssessments()
  }, [])

  async function fetchAssessments() {
    setLoading(false)
    const { data } = await supabase
      .from('assessments')
      .select('id, name, description, status, created_at')
      .order('created_at', { ascending: false })

    setAssessments(data as AssessmentRow[] ?? [])
    setLoading(false)
  }

  function statusBadge(status: AssessmentRow['status']) {
    const styles = {
      published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      draft: 'bg-amber-50 text-amber-700 border-amber-200',
      archived: 'bg-slate-100 text-slate-600 border-slate-200',
    }
    return (
      <span
        className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold capitalize ${styles[status]}`}
      >
        {status}
      </span>
    )
  }

  return (
    <AdminLayout
      title="Assessments"
      subtitle="Manage diagnostic tests, section modules, and student link delivery"
      actions={
        <Link
          to="/admin/assessments/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
        >
          + Create Assessment
        </Link>
      }
    >
      {loading ? (
        <p className="text-slate-500">Loading assessments...</p>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-600 font-medium">No assessments created yet.</p>
          <Link
            to="/admin/assessments/new"
            className="mt-3 inline-block text-xs bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg"
          >
            Create Your First Assessment
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {assessments.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-slate-900">{a.name}</h2>
                  {statusBadge(a.status)}
                </div>
                {a.description && (
                  <p className="text-xs text-slate-500 mt-1 max-w-xl">{a.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {a.status === 'published' && (
                  <button
                    type="button"
                    onClick={() => setShareTarget(a)}
                    className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold px-3 py-1.5 rounded-md transition"
                  >
                    🔗 Share Link
                  </button>
                )}
                <Link
                  to={`/admin/assessments/${a.id}/results`}
                  className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium px-3 py-1.5 rounded-md transition"
                >
                  Results
                </Link>
                <Link
                  to={`/admin/assessments/${a.id}`}
                  className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded-md transition"
                >
                  Edit / Modules →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {shareTarget && (
        <ShareAssessmentModal
          assessmentId={shareTarget.id}
          assessmentName={shareTarget.name}
          isOpen={true}
          onClose={() => setShareTarget(null)}
        />
      )}
    </AdminLayout>
  )
}