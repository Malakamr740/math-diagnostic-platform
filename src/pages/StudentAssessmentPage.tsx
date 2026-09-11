import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import DynamicRegistrationField from '../components/DynamicRegistrationField'

interface Assessment {
  id: string
  name: string
  description: string | null
  instructions: string | null
}

interface RegistrationField {
  id: string
  label: string
  field_key: string
  field_type: 'text' | 'email' | 'phone' | 'number' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 'textarea'
  is_required: boolean
  options: string[] | null
  display_order: number
}

export default function StudentAssessmentPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const navigate = useNavigate()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [fields, setFields] = useState<RegistrationField[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [assessmentId])

  async function fetchData() {
    if (!assessmentId) return
    setLoading(true)

    const { data: assessmentData, error: aError } = await supabase
      .from('assessments')
      .select('id, name, description, instructions')
      .eq('id', assessmentId)
      .single()

    if (aError || !assessmentData) {
      setError('This assessment link is invalid or no longer available.')
      setLoading(false)
      return
    }

    const { data: fieldData } = await supabase
      .from('registration_fields')
      .select('id, label, field_key, field_type, is_required, options, display_order')
      .order('display_order')

    setAssessment(assessmentData)
    setFields(fieldData ?? [])
    setLoading(false)
  }

  function updateValue(fieldKey: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldKey]: value }))
  }

  function validate(): boolean {
    const errors: Record<string, string> = {}
    for (const field of fields) {
      if (field.is_required && !values[field.field_key]?.trim()) {
        errors[field.field_key] = 'This field is required.'
      }
      if (field.field_type === 'email' && values[field.field_key]) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailPattern.test(values[field.field_key])) {
          errors[field.field_key] = 'Enter a valid email address.'
        }
      }
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!validate()) return

    setSubmitting(true)

    const { data, error: startError } = await supabase.rpc('start_attempt', {
      p_assessment_id: assessmentId,
      p_registration_data: values,
    })

    setSubmitting(false)

    if (startError || !data || data.length === 0) {
      setError(startError?.message || 'Could not start the assessment. Please try again.')
      return
    }

    const { attempt_id, resume_token } = data[0]

    // Navigate into the actual test-taking flow, carrying the resume
    // token — this is what lets the student's browser prove which
    // attempt is theirs on every subsequent request, without an account.
    navigate(`/take/${attempt_id}?token=${resume_token}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading...</p>
      </div>
    )
  }

  if (error && !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <p className="text-red-600 bg-red-50 rounded-md px-4 py-3 max-w-md text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h1 className="text-2xl font-semibold text-slate-900">{assessment?.name}</h1>
          {assessment?.description && (
            <p className="text-slate-600 mt-2">{assessment.description}</p>
          )}
          {assessment?.instructions && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-slate-700">
              {assessment.instructions}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-medium text-slate-800">Before You Begin</h2>

          {fields.map((field) => (
            <DynamicRegistrationField
              key={field.id}
              field={field}
              value={values[field.field_key] ?? ''}
              onChange={(value) => updateValue(field.field_key, value)}
              error={fieldErrors[field.field_key]}
            />
          ))}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Starting...' : 'Start Assessment'}
          </button>
        </form>
      </div>
    </div>
  )
}