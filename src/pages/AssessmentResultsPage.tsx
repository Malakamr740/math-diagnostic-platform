import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

interface RegistrationField {
  id: string
  label: string
  field_key: string
  display_order: number
}

interface AttemptRow {
  id: string
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  completed_at: string | null
  attempt_results: {
    percentage: number
    correct_count: number
    total_questions: number
    level: { name: string } | null
  } | null
  registration_responses: {
    responses: Record<string, unknown>
  } | null
}

export default function AssessmentResultsPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()

  const [assessmentName, setAssessmentName] = useState('')
  const [fields, setFields] = useState<RegistrationField[]>([])
  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId])

  async function fetchData() {
    if (!assessmentId) return
    setLoading(true)

    const { data: assessment } = await supabase
      .from('assessments')
      .select('name, organization_id')
      .eq('id', assessmentId)
      .single()

    if (!assessment) {
      setError('Could not load this assessment.')
      setLoading(false)
      return
    }
    setAssessmentName(assessment.name)

    // The registration form is per-org, not per-assessment — this tells us
    // which field_keys exist and what order/labels to show them in.
    const { data: fieldData } = await supabase
      .from('registration_fields')
      .select('id, label, field_key, display_order')
      .eq('organization_id', assessment.organization_id)
      .order('display_order')

    setFields(fieldData ?? [])

    const { data: attemptData, error: attemptError } = await supabase
      .from('attempts')
      .select(
        `
        id, status, started_at, completed_at,
        attempt_results ( percentage, correct_count, total_questions, level:levels ( name ) ),
        registration_responses ( responses )
      `
      )
      .eq('assessment_id', assessmentId)
      .order('started_at', { ascending: false })

    if (attemptError) {
      setError(attemptError.message)
      setLoading(false)
      return
    }

    setAttempts((attemptData as unknown as AttemptRow[]) ?? [])
    setLoading(false)
  }

  function studentLabel(attempt: AttemptRow): string {
    const responses = attempt.registration_responses?.responses
    if (!responses || fields.length === 0) return '(No registration data)'

    // Show up to the first 2 registration fields as the student's identity —
    // typically name + email/phone, since orgs order their form that way.
    return fields
      .slice(0, 2)
      .map((f) => responses[f.field_key])
      .filter((v) => v !== undefined && v !== null && v !== '')
      .join(' · ') || '(Unnamed)'
  }

  function statusBadge(status: AttemptRow['status']) {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      in_progress: 'bg-amber-100 text-amber-700',
      abandoned: 'bg-slate-200 text-slate-600',
    }
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${styles[status]}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading results...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link to={`/admin/assessments/${assessmentId}`} className="text-sm text-blue-600 hover:underline">
          ← Back to Assessment
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1">
          Results — {assessmentName}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{attempts.length} attempt(s)</p>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {attempts.length === 0 ? (
          <p className="text-slate-600 bg-white rounded-lg border border-slate-200 p-6 text-center">
            No one has attempted this assessment yet.
          </p>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-800">{studentLabel(attempt)}</td>
                    <td className="px-4 py-3">{statusBadge(attempt.status)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {attempt.attempt_results
                        ? `${attempt.attempt_results.percentage}% (${attempt.attempt_results.correct_count}/${attempt.attempt_results.total_questions})`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {attempt.attempt_results?.level?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {attempt.completed_at
                        ? new Date(attempt.completed_at).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {attempt.attempt_results && (
                        <Link
                          to={`/admin/attempts/${attempt.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          View Details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}