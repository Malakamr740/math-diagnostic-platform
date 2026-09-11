import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

interface LevelInfo {
  id: string
  name: string
  description: string | null
  recommendation: string | null
}

interface OverallResult {
  total_questions: number
  correct_count: number
  incorrect_count: number
  points_earned: number
  points_possible: number
  percentage: number
  calculated_at: string
  level: LevelInfo | null
}

interface CourseItem {
  id: string
  name: string
  description: string | null
  image_url: string | null
  registration_url: string | null
  whatsapp_url: string | null
  phone: string | null
}

interface OrgSettings {
  marketing_tagline: string | null
  contact_phone: string | null
  whatsapp_url: string | null
  website_url: string | null
}

interface BreakdownRow {
  type: 'module' | 'category' | 'chapter' | 'lesson' | 'skill' | 'difficulty'
  label: string
  total_questions: number
  correct_count: number
  points_earned: number
  points_possible: number
  percentage: number
  classification: 'strong' | 'weak' | 'average' | null
}

interface ReportData {
  overall: OverallResult
  breakdowns: BreakdownRow[]
  courses: CourseItem[]
  org_settings: OrgSettings | null
}

type ScreenState = 'loading' | 'ready' | 'error'

const BREAKDOWN_SECTION_TITLES: Record<BreakdownRow['type'], string> = {
  module: 'By Module',
  category: 'By Category',
  chapter: 'By Chapter',
  lesson: 'By Lesson',
  skill: 'By Skill',
  difficulty: 'By Difficulty',
}

const BREAKDOWN_ORDER: BreakdownRow['type'][] = [
  'module',
  'category',
  'chapter',
  'lesson',
  'skill',
  'difficulty',
]

function classificationStyles(classification: BreakdownRow['classification']) {
  switch (classification) {
    case 'strong':
      return 'bg-green-100 text-green-700'
    case 'weak':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export default function ReportPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const [searchParams] = useSearchParams()
  const resumeToken = searchParams.get('token')

  const [screen, setScreen] = useState<ScreenState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [report, setReport] = useState<ReportData | null>(null)

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadReport() {
    if (!attemptId || !resumeToken) {
      setScreen('error')
      setErrorMessage('This link is missing required information.')
      return
    }

    const { data, error } = await supabase.rpc('get_attempt_report', {
      p_attempt_id: attemptId,
      p_resume_token: resumeToken,
    })

    if (error || !data) {
      setScreen('error')
      setErrorMessage(
        error?.message?.includes('not yet available')
          ? 'Your results are still being processed. Please check back shortly.'
          : 'This report link is invalid or has expired.'
      )
      return
    }

    setReport(data as ReportData)
    setScreen('ready')
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading your results...</p>
      </div>
    )
  }

  if (screen === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <p className="text-red-600 bg-red-50 rounded-md px-4 py-3 max-w-md text-center">
          {errorMessage}
        </p>
      </div>
    )
  }

  const overall = report!.overall
  const courses = report!.courses ?? []
  const orgSettings = report!.org_settings

  const breakdownsByType = BREAKDOWN_ORDER.map((type) => ({
    type,
    rows: report!.breakdowns.filter((b) => b.type === type),
  })).filter((section) => section.rows.length > 0)

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            Assessment Diagnostic Report
          </h1>
          {orgSettings?.website_url && (
            <a
              href={orgSettings.website_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Visit Website ↗
            </a>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Overall score card */}
        <section className="bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-sm text-slate-500 mb-1">Overall Score</p>
          <p className="text-5xl font-bold text-slate-900 mb-2">
            {overall.percentage}%
          </p>
          <p className="text-slate-600 mb-6">
            {overall.correct_count} of {overall.total_questions} questions correct
            {' '}&middot;{' '}
            {overall.points_earned} / {overall.points_possible} points
          </p>

          {overall.level && (
            <div className="inline-block bg-blue-50 border border-blue-100 rounded-lg px-6 py-4 text-left max-w-md w-full">
              <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-1">
                Assigned Level: {overall.level.name}
              </p>
              {overall.level.description && (
                <p className="text-sm text-slate-700 mb-2">{overall.level.description}</p>
              )}
              {overall.level.recommendation && (
                <p className="text-sm text-slate-600 italic">{overall.level.recommendation}</p>
              )}
            </div>
          )}
        </section>

        {/* Recommended courses if any are matched to the level */}
        {courses.length > 0 && (
          <section className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-3">Recommended Next Step Courses</h2>
            <div className="space-y-4">
              {courses.map((course) => (
                <div key={course.id} className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start justify-between bg-slate-50">
                  <div>
                    <h3 className="font-semibold text-slate-800">{course.name}</h3>
                    {course.description && <p className="text-sm text-slate-600 mt-1">{course.description}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {course.registration_url && (
                      <a
                        href={course.registration_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                      >
                        Enroll Now
                      </a>
                    )}
                    {course.whatsapp_url && (
                      <a
                        href={course.whatsapp_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Breakdown sections */}
        {breakdownsByType.map(({ type, rows }) => (
          <section key={type} className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              {BREAKDOWN_SECTION_TITLES[type]}
            </h2>
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={`${type}-${row.label}`}
                  className="flex items-center justify-between border-b border-slate-100 last:border-0 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{row.label}</p>
                    <p className="text-xs text-slate-500">
                      {row.correct_count} / {row.total_questions} correct
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">
                      {row.percentage}%
                    </span>
                    {row.classification && (
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${classificationStyles(
                          row.classification
                        )}`}
                      >
                        {row.classification}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {orgSettings?.marketing_tagline && (
          <footer className="text-center text-xs text-slate-400 pt-4">
            <p>{orgSettings.marketing_tagline}</p>
          </footer>
        )}
      </main>
    </div>
  )
}