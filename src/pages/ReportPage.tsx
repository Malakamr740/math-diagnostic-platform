import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ContentBlockRenderer, { type ContentBlock } from '../components/ContentBlockRenderer'

interface StudentInfo {
  attempt_id: string
  assessment_name: string
  started_at: string
  completed_at: string | null
  total_time_seconds: number
  registration_responses: Record<string, string>
}

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
  avg_time_per_question: number
  avg_time_correct: number
  avg_time_incorrect: number
  rushed_mistakes_count: number
  timesink_mistakes_count: number
  level: LevelInfo | null
}

interface DiagnosticNote {
  type: 'warning' | 'caution' | 'critical' | 'success' | 'strength' | 'priority'
  title: string
  body: string
}

interface BreakdownRow {
  type: 'module' | 'category' | 'chapter' | 'lesson' | 'skill' | 'difficulty'
  id: string | null
  label: string
  total_questions: number
  correct_count: number
  points_earned: number
  points_possible: number
  percentage: number
  classification: 'strong' | 'weak' | 'average' | null
  avg_time_seconds?: number
}

interface ChoiceOption {
  id: string
  content_blocks: ContentBlock[]
  is_correct: boolean
}

interface QuestionReviewItem {
  question_id: string
  content_blocks: ContentBlock[]
  explanation_blocks: ContentBlock[]
  difficulty: 'easy' | 'medium' | 'hard'
  answer_type_code: string
  points_possible: number
  points_earned: number
  is_correct: boolean
  time_spent_seconds: number
  student_answer: Record<string, unknown>
  category_name: string | null
  lesson_name: string | null
  skill_name: string | null
  choices: ChoiceOption[]
  correct_answer_data?: { value: unknown; tolerance?: number }
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
  org_name: string
  marketing_tagline: string | null
  contact_phone: string | null
  whatsapp_url: string | null
  website_url: string | null
}

interface ReportData {
  student_info: StudentInfo
  overall: OverallResult
  diagnostic_notes: DiagnosticNote[]
  breakdowns: BreakdownRow[]
  questions: QuestionReviewItem[]
  courses: CourseItem[]
  org_settings: OrgSettings | null
}

type TabKey = 'executive' | 'behavior' | 'matrix' | 'questions' | 'action_plan'
type QuestionFilter = 'all' | 'incorrect' | 'rushed' | 'timesink' | 'hard'

export default function ReportPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const [searchParams] = useSearchParams()
  const resumeToken = searchParams.get('token')

  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('executive')
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>('all')
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    async function loadReport() {
      if (!attemptId || !resumeToken) {
        setErrorMessage('This diagnostic link is missing required authentication tokens.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase.rpc('get_attempt_report', {
        p_attempt_id: attemptId,
        p_resume_token: resumeToken,
      })

      if (error || !data) {
        setErrorMessage(
          error?.message?.includes('not yet available')
            ? 'Your diagnostic assessment results are currently compiling. Please refresh.'
            : 'Diagnostic report not found or expired.'
        )
        setLoading(false)
        return
      }

      setReport(data as ReportData)
      setLoading(false)
    }

    loadReport()
  }, [attemptId, resumeToken])

  function handleCopyShare() {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Synthesizing Diagnostic Analytics...</p>
        </div>
      </div>
    )
  }

  if (errorMessage || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-2xl p-6 max-w-md w-full text-center shadow-xs">
          <span className="text-3xl mb-2 block">⚠️</span>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Diagnostic Report Unavailable</h2>
          <p className="text-xs text-red-600 mb-4">{errorMessage}</p>
          <a
            href="/"
            className="inline-block text-xs bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg"
          >
            Return to Assessment Home
          </a>
        </div>
      </div>
    )
  }

  const { student_info, overall, diagnostic_notes, breakdowns, questions, courses, org_settings } = report

  const categoryBreakdowns = breakdowns.filter((b) => b.type === 'category')
  const skillBreakdowns = breakdowns.filter((b) => b.type === 'skill')
  const difficultyBreakdowns = breakdowns.filter((b) => b.type === 'difficulty')

  const studentName =
    student_info.registration_responses['full_name'] ||
    student_info.registration_responses['name'] ||
    'Candidate'

  const totalMinutes = Math.floor(student_info.total_time_seconds / 60)
  const totalSeconds = student_info.total_time_seconds % 60

  const weakSkills = skillBreakdowns.filter((s) => s.classification === 'weak')
  const averageSkills = skillBreakdowns.filter((s) => s.classification === 'average')
  const strongSkills = skillBreakdowns.filter((s) => s.classification === 'strong')

  const filteredQuestions = questions.filter((q) => {
    if (questionFilter === 'incorrect') return !q.is_correct
    if (questionFilter === 'rushed') return !q.is_correct && q.time_spent_seconds < 25
    if (questionFilter === 'timesink') return !q.is_correct && q.time_spent_seconds >= 100
    if (questionFilter === 'hard') return q.difficulty === 'hard'
    return true
  })

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans pb-16">
      {/* Sticky Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 print:static">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              📊
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                {org_settings?.org_name || 'Academic Diagnostic Center'}
              </span>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Comprehensive Diagnostic Analysis
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleCopyShare}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
            >
              {copiedLink ? '✓ Copied' : '🔗 Share Link'}
            </button>
            <button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <span>🖨️</span> Save Official PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Candidate Profile Banner */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-black text-2xl flex items-center justify-center shadow-xs">
                {studentName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">{studentName}</h2>
                <p className="text-xs font-semibold text-slate-500">
                  Target Exam: <span className="text-slate-800">{student_info.assessment_name}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              {Object.entries(student_info.registration_responses).map(([key, val]) => (
                <span
                  key={key}
                  className="bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg"
                >
                  <strong className="capitalize text-slate-700">{key.replace('_', ' ')}:</strong> {val}
                </span>
              ))}
            </div>
          </div>

          <div className="flex sm:grid sm:grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 shrink-0">
            <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100 min-w-[95px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Date</span>
              <p className="text-xs font-bold text-slate-800 mt-1">
                {student_info.completed_at
                  ? new Date(student_info.completed_at).toLocaleDateString()
                  : 'Today'}
              </p>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100 min-w-[95px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Pacing</span>
              <p className="text-xs font-bold text-slate-800 mt-1 font-mono">
                {totalMinutes}m {totalSeconds}s
              </p>
            </div>
            <div className="text-center p-3 rounded-xl bg-blue-50 border border-blue-200 min-w-[95px]">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Readiness Tier</span>
              <p className="text-xs font-black text-blue-900 mt-1 truncate">
                {overall.level?.name || 'Evaluated'}
              </p>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 flex gap-2 overflow-x-auto print:hidden">
          {(
            [
              { key: 'executive', label: '🎯 Executive Summary & Notes' },
              { key: 'behavior', label: '⏱ Behavioral Pacing & Traps' },
              { key: 'matrix', label: '📊 Domain & Skill Matrix' },
              { key: 'questions', label: `📝 Itemized Solutions (${questions.length})` },
              { key: 'action_plan', label: '🚀 Prescribed Action Plan' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-4 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========================================================= */}
        {/* TAB 1: EXECUTIVE SUMMARY & PEDAGOGICAL NOTES */}
        {/* ========================================================= */}
        {(activeTab === 'executive' || typeof window === 'undefined') && (
          <div className="space-y-6">
            {/* High Impact Metric Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Scorecard Hero */}
              <div className="md:col-span-5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white rounded-2xl p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                    Calculated Accuracy
                  </span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-6xl font-black tracking-tight">{overall.percentage}%</span>
                    <span className="text-xs text-slate-400 font-medium">overall score</span>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-slate-700/60 mt-6 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Points Achieved:</span>
                    <span className="font-bold text-slate-100">
                      {overall.points_earned} / {overall.points_possible} pts
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Item Breakdown:</span>
                    <span className="font-bold text-slate-100">
                      <span className="text-emerald-400">{overall.correct_count} Correct</span> &middot;{' '}
                      <span className="text-rose-400">{overall.incorrect_count} Incorrect</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Average Pacing:</span>
                    <span className="font-bold text-slate-100 font-mono">
                      ⏱ {overall.avg_time_per_question}s / question
                    </span>
                  </div>
                </div>
              </div>

              {/* Readiness Tier Description */}
              <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                      Placement: {overall.level?.name || 'Evaluated'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-2">
                    Baseline Performance Appraisal
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    {overall.level?.description ||
                      'The diagnostic evaluation models readiness across core and advanced mathematics.'}
                  </p>
                </div>

                {overall.level?.recommendation && (
                  <div className="mt-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200/80">
                    <span className="text-xs font-bold text-amber-900 block mb-1">
                      🎯 Targeted Instructor Prescription:
                    </span>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                      {overall.level.recommendation}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Algorithmic Diagnostic Insights Notes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Automated Pedagogical Notes & Behavioral Insights
                </h3>
                <p className="text-xs text-slate-500">
                  Synthesized observations based on your answer speeds, error patterns, and difficulty curves.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {diagnostic_notes && diagnostic_notes.length > 0 ? (
                  diagnostic_notes.map((note, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border text-xs space-y-1 ${
                        note.type === 'critical'
                          ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                          : note.type === 'caution' || note.type === 'warning'
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                          : note.type === 'priority'
                          ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                          : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <span className="font-black text-[11px] uppercase tracking-wider block">
                        {note.type === 'critical' && '🚨 '}
                        {note.type === 'warning' && '⚡ '}
                        {note.type === 'caution' && '⏱ '}
                        {note.type === 'priority' && '🎯 '}
                        {note.type === 'strength' && '🌟 '}
                        {note.type === 'success' && '✓ '}
                        {note.title}
                      </span>
                      <p className="leading-relaxed font-medium">{note.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 col-span-2 text-center">
                    No anomalies detected during test execution.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: BEHAVIORAL PACING & TRAP ANALYSIS */}
        {/* ========================================================= */}
        {(activeTab === 'behavior' || typeof window === 'undefined') && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-slate-400">Avg Pace (Correct)</span>
                <p className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                  ⏱ {overall.avg_time_correct}s
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">Speed when solving accurately</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-slate-400">Avg Pace (Incorrect)</span>
                <p className="text-2xl font-black text-rose-600 mt-2 font-mono">
                  ⏱ {overall.avg_time_incorrect}s
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">Time spent on questions missed</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-amber-500">Rushed Misses</span>
                <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  {overall.rushed_mistakes_count}
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">Incorrect in &lt;25s (careless)</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase text-rose-500">Time Traps</span>
                <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  {overall.timesink_mistakes_count}
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">Incorrect after &gt;100s</span>
              </div>
            </div>

            {/* Cognitive Difficulty Performance Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900">Difficulty Curve & Cognitive Depth</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['easy', 'medium', 'hard'] as const).map((diff) => {
                  const data = difficultyBreakdowns.find((d) => d.label.toLowerCase() === diff)
                  const count = data?.total_questions || 0
                  const correct = data?.correct_count || 0
                  const pct = data?.percentage || 0
                  const time = data?.avg_time_seconds || 0

                  return (
                    <div key={diff} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-slate-700">{diff}</span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            pct >= 75
                              ? 'bg-emerald-100 text-emerald-800'
                              : pct <= 50
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <p className="text-2xl font-black text-slate-900">
                        {correct} / {count}
                      </p>
                      <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 flex justify-between font-medium">
                        <span>Pace:</span>
                        <span className="font-mono text-slate-800">{time}s avg</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DOMAIN & SKILL MATRIX */}
        {/* ========================================================= */}
        {(activeTab === 'matrix' || typeof window === 'undefined') && (
          <div className="space-y-6">
            {/* Domain Mastery Bars */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-1">Content Domain Performance</h3>
              <p className="text-xs text-slate-500 mb-5">
                Evaluated balance across all primary content domains in the curriculum.
              </p>

              <div className="space-y-4">
                {categoryBreakdowns.map((cat) => (
                  <div key={cat.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800">{cat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-medium">
                          {cat.correct_count}/{cat.total_questions} correct
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md capitalize text-[11px] ${
                            cat.classification === 'strong'
                              ? 'bg-emerald-100 text-emerald-800'
                              : cat.classification === 'weak'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {cat.percentage}% &middot; {cat.classification || 'average'}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cat.classification === 'strong'
                            ? 'bg-emerald-500'
                            : cat.classification === 'weak'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.max(5, cat.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Three-Tier Categorized Skill Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Critical Focus Areas */}
              <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-rose-700">
                  <span className="text-lg">🔴</span>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    Critical Remediation ({weakSkills.length})
                  </h4>
                </div>
                <div className="divide-y divide-rose-100 text-xs">
                  {weakSkills.map((sk) => (
                    <div key={sk.label} className="py-2.5 flex justify-between items-center">
                      <span className="font-semibold text-slate-800 pr-2">{sk.label}</span>
                      <span className="font-black text-rose-600 shrink-0">{sk.percentage}%</span>
                    </div>
                  ))}
                  {weakSkills.length === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">No critical gaps identified.</p>
                  )}
                </div>
              </div>

              {/* Developing Competencies */}
              <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <span className="text-lg">🟡</span>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    Developing ({averageSkills.length})
                  </h4>
                </div>
                <div className="divide-y divide-amber-100 text-xs">
                  {averageSkills.map((sk) => (
                    <div key={sk.label} className="py-2.5 flex justify-between items-center">
                      <span className="font-semibold text-slate-800 pr-2">{sk.label}</span>
                      <span className="font-black text-amber-600 shrink-0">{sk.percentage}%</span>
                    </div>
                  ))}
                  {averageSkills.length === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">No developing skills.</p>
                  )}
                </div>
              </div>

              {/* Mastered Strengths */}
              <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <span className="text-lg">🟢</span>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    Mastered ({strongSkills.length})
                  </h4>
                </div>
                <div className="divide-y divide-emerald-100 text-xs">
                  {strongSkills.map((sk) => (
                    <div key={sk.label} className="py-2.5 flex justify-between items-center">
                      <span className="font-semibold text-slate-800 pr-2">{sk.label}</span>
                      <span className="font-black text-emerald-600 shrink-0">{sk.percentage}%</span>
                    </div>
                  ))}
                  {strongSkills.length === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">Practice to establish mastery.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: ITEMIZED QUESTION SOLUTIONS & EXPLANATIONS */}
        {/* ========================================================= */}
        {(activeTab === 'questions' || typeof window === 'undefined') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { key: 'all', label: 'All Items' },
                    { key: 'incorrect', label: `✕ Missed (${overall.incorrect_count})` },
                    { key: 'rushed', label: `⚡ Rushed (<25s)` },
                    { key: 'timesink', label: `⏱ Time Sink (>100s)` },
                    { key: 'hard', label: `🔥 Hard Items` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setQuestionFilter(f.key)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                      questionFilter === f.key
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Showing {filteredQuestions.length} of {questions.length} items
              </span>
            </div>

            <div className="space-y-4">
              {filteredQuestions.map((q, idx) => (
                <div
                  key={q.question_id}
                  className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-xs space-y-4 transition ${
                    q.is_correct ? 'border-slate-200' : 'border-rose-200 bg-rose-50/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md capitalize ${
                          q.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {q.is_correct ? '✓ Correct' : '✕ Incorrect'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {q.skill_name && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                          {q.skill_name}
                        </span>
                      )}
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium capitalize">
                        {q.difficulty}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          !q.is_correct && q.time_spent_seconds >= 100
                            ? 'bg-rose-100 text-rose-800'
                            : !q.is_correct && q.time_spent_seconds < 25
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        ⏱ {q.time_spent_seconds}s
                      </span>
                    </div>
                  </div>

                  {/* Question Stem */}
                  <div className="text-sm font-medium text-slate-900 leading-relaxed">
                    <ContentBlockRenderer blocks={q.content_blocks} />
                  </div>

                  {/* MCQ Options */}
                  {q.answer_type_code === 'MCQ' && (
                    <div className="space-y-2 pt-2">
                      {q.choices.map((ch, cIndex) => {
                        const isStudentSelected = q.student_answer?.choice_id === ch.id
                        const isChoiceCorrect = ch.is_correct

                        let choiceStyle = 'border-slate-200 bg-slate-50/60'
                        if (isChoiceCorrect) {
                          choiceStyle = 'border-emerald-500 bg-emerald-50/80 text-emerald-900 font-semibold'
                        } else if (isStudentSelected && !isChoiceCorrect) {
                          choiceStyle = 'border-rose-400 bg-rose-50 text-rose-900 line-through'
                        }

                        return (
                          <div
                            key={ch.id}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${choiceStyle}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold w-4">{String.fromCharCode(65 + cIndex)}.</span>
                              <div>
                                <ContentBlockRenderer blocks={ch.content_blocks} />
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5 font-bold text-[11px]">
                              {isChoiceCorrect && <span className="text-emerald-700">✓ Correct Answer</span>}
                              {isStudentSelected && !isChoiceCorrect && (
                                <span className="text-rose-600">✕ Selected Answer</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Grid-In Numeric */}
                  {q.answer_type_code !== 'MCQ' && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <p>
                        <strong className="text-slate-700">Your Input:</strong>{' '}
                        <span className={`font-bold ${q.is_correct ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {String(q.student_answer?.value ?? 'Unanswered')}
                        </span>
                      </p>
                      {!q.is_correct && q.correct_answer_data && (
                        <p>
                          <strong className="text-slate-700">Official Correct Answer:</strong>{' '}
                          <span className="font-bold text-emerald-700">
                            {String(q.correct_answer_data.value)}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Step-by-Step Instructor Solution */}
                  {q.explanation_blocks && q.explanation_blocks.length > 0 && (
                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-800 space-y-1.5">
                      <span className="font-bold text-blue-900 block uppercase tracking-wider text-[10px]">
                        💡 Step-by-Step Instructor Solution
                      </span>
                      <div className="leading-relaxed">
                        <ContentBlockRenderer blocks={q.explanation_blocks} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: RECOMMENDED ACTION PLAN & NEXT STEPS */}
        {/* ========================================================= */}
        {(activeTab === 'action_plan' || typeof window === 'undefined') && (
          <div className="space-y-6">
            {courses.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Curated Courses for {overall.level?.name || 'Your Readiness Tier'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Courses and masterclasses calibrated directly to your evaluated skill gaps.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {courses.map((c) => (
                    <div
                      key={c.id}
                      className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{c.name}</h4>
                        {c.description && (
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{c.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        {c.registration_url && (
                          <a
                            href={c.registration_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-2 rounded-lg transition"
                          >
                            Enroll in Course →
                          </a>
                        )}
                        {c.whatsapp_url && (
                          <a
                            href={c.whatsapp_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1"
                          >
                            <span>💬</span> WhatsApp Inquiry
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Academic Consultation CTA */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-black">Want to Review Your Diagnostic Test with an Instructor?</h3>
                <p className="text-xs text-blue-100 mt-1 max-w-md leading-relaxed">
                  Book a 1-on-1 strategy call to break down careless errors, refine test pacing, and map a timeline to your target score.
                </p>
              </div>

              {org_settings?.whatsapp_url ? (
                <a
                  href={org_settings.whatsapp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white text-blue-900 hover:bg-blue-50 font-black text-xs px-5 py-3 rounded-xl transition shrink-0 shadow-xs"
                >
                  💬 Schedule Strategy Session
                </a>
              ) : (
                <button
                  onClick={() => window.print()}
                  className="bg-white text-blue-900 hover:bg-blue-50 font-black text-xs px-5 py-3 rounded-xl transition shrink-0 shadow-xs"
                >
                  🖨️ Download Printable PDF
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-slate-400 pt-6 border-t border-slate-200">
          <p>{org_settings?.marketing_tagline || 'Academic Evaluation & Diagnostic Platform'}</p>
          <p className="mt-1">
            Verification ID: <span className="font-mono">{student_info.attempt_id}</span>
          </p>
        </footer>
      </main>
    </div>
  )
}