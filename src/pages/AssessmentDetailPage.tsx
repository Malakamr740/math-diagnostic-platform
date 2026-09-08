import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

interface Assessment {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'published' | 'archived'
}

export default function AssessmentDetailPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAssessment() {
      if (!assessmentId) return
      const { data } = await supabase
        .from('assessments')
        .select('id, name, description, status')
        .eq('id', assessmentId)
        .single()
      setAssessment(data)
      setLoading(false)
    }
    fetchAssessment()
  }, [assessmentId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading...</p>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-red-600">Assessment not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link to="/admin/assessments" className="text-sm text-blue-600 hover:underline">
          ← Back to Assessments
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1">{assessment.name}</h1>
        {assessment.description && (
          <p className="text-sm text-slate-500 mt-1">{assessment.description}</p>
        )}
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-slate-600">
          Module management coming in the next step — this is where you'll add Module 1,
          Module 2, etc., and assign questions to each.
        </p>
      </main>
    </div>
  )
}