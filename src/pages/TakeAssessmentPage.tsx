import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ContentBlockRenderer, { type ContentBlock } from '../components/ContentBlockRenderer'
import QuestionAnswerInput from '../components/QuestionAnswerInput'

interface ModuleInfo {
  id: string
  name: string
  description: string | null
  display_order: number
  timing_enabled: boolean
  time_limit_minutes: number | null
}

interface AttemptQuestion {
  question_id: string
  content_blocks: ContentBlock[]
  answer_type_code: string
  points: number
  required: boolean
  difficulty?: 'easy' | 'medium' | 'hard' // 👈 ADD THIS LINE
  choices: { id: string; content_blocks: ContentBlock[] }[]
}
type ScreenState =
  | 'loading'
  | 'module_intro'
  | 'in_progress'
  | 'module_complete'
  | 'assessment_complete'
  | 'error'

export default function TakeAssessmentPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const [searchParams] = useSearchParams()
  const resumeToken = searchParams.get('token')

  const [screen, setScreen] = useState<ScreenState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [modules, setModules] = useState<ModuleInfo[]>([])
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0)

  const [moduleAttemptId, setModuleAttemptId] = useState<string | null>(null)
  const [orderedQuestionIds, setOrderedQuestionIds] = useState<string[]>([])
  const [questionsById, setQuestionsById] = useState<Record<string, AttemptQuestion>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({})

  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const moduleStartTimeRef = useRef<number>(Date.now())
  const questionStartTimeRef = useRef<number>(Date.now())
  const submittingRef = useRef(false)

  useEffect(() => {
    loadAssessmentModules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAssessmentModules() {
    if (!attemptId || !resumeToken) {
      setScreen('error')
      setErrorMessage('This link is missing required information.')
      return
    }

    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('assessment_id')
      .eq('id', attemptId)
      .eq('resume_token', resumeToken)
      .single()

    if (attemptError || !attempt) {
      setScreen('error')
      setErrorMessage('This assessment link is invalid or has expired.')
      return
    }

    const { data: moduleData } = await supabase
      .from('modules')
      .select('id, name, description, display_order, timing_enabled, time_limit_minutes')
      .eq('assessment_id', attempt.assessment_id)
      .order('display_order')

    setModules(moduleData ?? [])
    setScreen('module_intro')
  }

  async function beginCurrentModule() {
    const currentModule = modules[currentModuleIndex]
    if (!attemptId || !resumeToken || !currentModule) return

    const { data, error } = await supabase.rpc('start_module_attempt', {
      p_attempt_id: attemptId,
      p_resume_token: resumeToken,
      p_module_id: currentModule.id,
    })

    if (error || !data || data.length === 0) {
      setScreen('error')
      setErrorMessage(error?.message || 'Could not start this module.')
      return
    }

    const { module_attempt_id, question_order, started_at } = data[0]
    setModuleAttemptId(module_attempt_id)
    const ids: string[] = question_order ?? []
    setOrderedQuestionIds(ids)

    const { data: questionData, error: qError } = await supabase.rpc('get_attempt_questions', {
      p_attempt_id: attemptId,
      p_resume_token: resumeToken,
      p_module_id: currentModule.id,
    })

    if (qError || !questionData) {
      setScreen('error')
      setErrorMessage(qError?.message || 'Could not load questions.')
      return
    }

    const byId: Record<string, AttemptQuestion> = {}
    for (const q of questionData) {
      byId[q.question_id] = q
    }
    setQuestionsById(byId)

    // Restore previously saved answers
    const { data: savedAnswers } = await supabase.rpc('get_saved_answers', {
      p_attempt_id: attemptId,
      p_resume_token: resumeToken,
      p_module_attempt_id: module_attempt_id,
    })

    if (savedAnswers) {
      const restored: Record<string, Record<string, unknown>> = {}
      for (const a of savedAnswers) {
        restored[a.question_id] = a.answer_data
      }
      setAnswers(restored)
    }

    // Set up the countdown timer
    if (currentModule.timing_enabled && currentModule.time_limit_minutes) {
      const elapsedMs = Date.now() - new Date(started_at).getTime()
      const totalSeconds = currentModule.time_limit_minutes * 60
      setSecondsRemaining(Math.max(0, totalSeconds - Math.floor(elapsedMs / 1000)))
    } else {
      setSecondsRemaining(null)
    }

    moduleStartTimeRef.current = new Date(started_at).getTime()
    questionStartTimeRef.current = Date.now()
    setCurrentQuestionIndex(0)
    setScreen('in_progress')
  }

  // Countdown timer effect
  useEffect(() => {
    if (screen !== 'in_progress' || secondsRemaining === null) return

    if (secondsRemaining <= 0) {
      handleSubmitModule(true)
      return
    }

    const timer = setTimeout(() => setSecondsRemaining((s) => (s !== null ? s - 1 : null)), 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, secondsRemaining])

  async function saveCurrentAnswer(questionId: string, value: Record<string, unknown>) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    setErrorMessage('') // Clear error message as soon as student answers

    if (!attemptId || !resumeToken || !moduleAttemptId) return

    const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000)

    await supabase.rpc('save_answer', {
      p_attempt_id: attemptId,
      p_resume_token: resumeToken,
      p_module_attempt_id: moduleAttemptId,
      p_question_id: questionId,
      p_answer_data: value,
      p_time_spent_seconds: timeSpent,
    })
  }

  function goToQuestion(index: number) {
    if (index < 0 || index >= orderedQuestionIds.length) return
    questionStartTimeRef.current = Date.now()
    setCurrentQuestionIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function isQuestionAnswered(qId: string): boolean {
    const val = answers[qId]
    if (!val) return false
    if (val.choice_id) return true
    if (val.value !== undefined && String(val.value).trim() !== '') return true
    return false
  }

  async function handleSubmitModule(timedOut: boolean) {
    if (submittingRef.current) return
    submittingRef.current = true
    setErrorMessage('')

    if (!timedOut) {
      const missingIndexes: number[] = []
      orderedQuestionIds.forEach((id, idx) => {
        if (!isQuestionAnswered(id)) {
          missingIndexes.push(idx + 1)
        }
      })

      if (missingIndexes.length > 0) {
        setErrorMessage(
          `Please answer Question${missingIndexes.length > 1 ? 's' : ''} ${missingIndexes.join(
            ', '
          )} before submitting.`
        )
        submittingRef.current = false
        // Jump directly to the first unanswered question
        goToQuestion(missingIndexes[0] - 1)
        return
      }
    }

    if (attemptId && resumeToken && moduleAttemptId) {
      const elapsed = Math.floor((Date.now() - moduleStartTimeRef.current) / 1000)
      const { error } = await supabase.rpc('submit_module_attempt', {
        p_attempt_id: attemptId,
        p_resume_token: resumeToken,
        p_module_attempt_id: moduleAttemptId,
        p_elapsed_seconds: elapsed,
        p_timed_out: timedOut,
      })

      if (error) {
        setErrorMessage(error.message)
        submittingRef.current = false
        return
      }
    }

    submittingRef.current = false

    if (currentModuleIndex >= modules.length - 1) {
      setScreen('assessment_complete')
    } else {
      setScreen('module_complete')
    }
  }

  function goToNextModule() {
    setCurrentModuleIndex((i) => i + 1)
    setScreen('module_intro')
  }

  function formatTime(totalSeconds: number) {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Loading Assessment...</p>
      </div>
    )
  }

  if (screen === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 text-center shadow-xs">
          <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
        </div>
      </div>
    )
  }

  if (screen === 'module_intro') {
    const currentModule = modules[currentModuleIndex]
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xs border border-slate-200 p-8 text-center space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            Module {currentModuleIndex + 1} of {modules.length}
          </span>
          <h1 className="text-2xl font-black text-slate-900">{currentModule?.name}</h1>
          {currentModule?.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{currentModule.description}</p>
          )}
          {currentModule?.timing_enabled && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-700">
              ⏱ Time Limit: {currentModule.time_limit_minutes} minutes
            </div>
          )}
          <button
            onClick={beginCurrentModule}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-xs"
          >
            Start This Section →
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'module_complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xs border border-slate-200 p-8 text-center space-y-4">
          <span className="text-4xl block">🎉</span>
          <h1 className="text-2xl font-black text-slate-900">Section Complete</h1>
          <p className="text-sm text-slate-600">
            You've completed Module {currentModuleIndex + 1}. Ready for the next section?
          </p>
          <button
            onClick={goToNextModule}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition"
          >
            Continue to Module {currentModuleIndex + 2} →
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'assessment_complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xs border border-slate-200 p-8 text-center space-y-4">
          <span className="text-5xl block">🏆</span>
          <h1 className="text-2xl font-black text-slate-900">Assessment Finished!</h1>
          <p className="text-sm text-slate-600">
            Your responses have been saved and scored. View your detailed diagnostic report below:
          </p>
          <Link
            to={`/report/${attemptId}?token=${resumeToken}`}
            className="inline-block w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition shadow-xs"
          >
            View My Diagnostic Results →
          </Link>
        </div>
      </div>
    )
  }

  const currentQuestionId = orderedQuestionIds[currentQuestionIndex]
  const currentQuestion = currentQuestionId ? questionsById[currentQuestionId] : null
  const totalCount = orderedQuestionIds.length
  const answeredCount = orderedQuestionIds.filter(isQuestionAnswered).length

  return (
    <div className="min-h-screen bg-slate-100/70 pb-16">
      {/* Sticky Test Header with Question Navigator Strip */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {modules[currentModuleIndex]?.name}
            </span>
            <p className="text-xs font-bold text-slate-800">
              Answered {answeredCount} of {totalCount} questions
            </p>
          </div>

          {secondsRemaining !== null && (
            <div
              className={`font-mono text-xs font-bold px-3 py-1.5 rounded-lg border ${
                secondsRemaining < 120
                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                  : 'bg-slate-50 text-slate-800 border-slate-200'
              }`}
            >
              ⏱ {formatTime(Math.max(0, secondsRemaining))}
            </div>
          )}
        </div>

        {/* Interactive Question Palette */}
        <div className="max-w-3xl mx-auto pt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
          {orderedQuestionIds.map((id, idx) => {
            const isAnswered = isQuestionAnswered(id)
            const isCurrent = idx === currentQuestionIndex

            let btnClass = 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
            if (isCurrent) {
              btnClass = 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold ring-2 ring-blue-300'
            } else if (isAnswered) {
              btnClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
            }

            return (
              <button
                key={id}
                type="button"
                onClick={() => goToQuestion(idx)}
                className={`w-7 h-7 shrink-0 rounded-lg text-xs border flex items-center justify-center transition ${btnClass}`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>
      </header>

      {/* Main Question Card */}
      <main className="max-w-3xl mx-auto px-4 pt-6">
        {errorMessage && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span> {errorMessage}
          </div>
        )}

        {currentQuestion ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-800">
                Question {currentQuestionIndex + 1} of {totalCount}
              </span>
              <span className="bg-slate-100 px-2 py-0.5 rounded capitalize font-medium text-slate-600">
                {currentQuestion.difficulty || 'medium'} &middot; {currentQuestion.points || 1} pt
              </span>
            </div>

            {/* Question Prompt */}
            <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
              <ContentBlockRenderer blocks={currentQuestion.content_blocks} />
            </div>

            {/* Answer Input Component */}
            <div className="pt-2">
              <QuestionAnswerInput
                answerTypeCode={currentQuestion.answer_type_code}
                choices={currentQuestion.choices}
                value={answers[currentQuestion.question_id] ?? {}}
                onChange={(value) => saveCurrentAnswer(currentQuestion.question_id, value)}
              />
            </div>

            {/* Bottom Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => goToQuestion(currentQuestionIndex - 1)}
                disabled={currentQuestionIndex === 0}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-30"
              >
                ← Previous
              </button>

              {currentQuestionIndex < totalCount - 1 ? (
                <button
                  type="button"
                  onClick={() => goToQuestion(currentQuestionIndex + 1)}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmitModule(false)}
                  className="px-6 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
                >
                  Submit Section ✓
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-12">No questions loaded in this section.</p>
        )}
      </main>
    </div>
  )
}