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
  choices: { id: string; content_blocks: ContentBlock[] }[]
}

type ScreenState = 'loading' | 'module_intro' | 'in_progress' | 'module_complete' | 'assessment_complete' | 'error'

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

    // Restore previously saved answers (refresh-recovery)
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

    // Set up the timer, accounting for time already elapsed if resuming
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

  // Countdown timer
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
    questionStartTimeRef.current = Date.now()
    setCurrentQuestionIndex(index)
  }

  async function handleSubmitModule(timedOut: boolean) {
    if (submittingRef.current) return
    submittingRef.current = true

    if (!timedOut) {
      const unansweredRequired = orderedQuestionIds.filter((id) => questionsById[id]?.required && Object.keys(answers[id] ?? {}).length === 0)
      if (unansweredRequired.length > 0) {
        setErrorMessage(`Answer all ${unansweredRequired.length} required question${unansweredRequired.length === 1 ? '' : 's'} before submitting.`)
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

  // ============================================================
  // RENDER
  // ============================================================

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading...</p>
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

  if (screen === 'module_intro') {
    const currentModule = modules[currentModuleIndex]
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-sm text-slate-500 mb-2">
            Module {currentModuleIndex + 1} of {modules.length}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">{currentModule?.name}</h1>
          {currentModule?.description && (
            <p className="text-slate-600 mb-4">{currentModule.description}</p>
          )}
          {currentModule?.timing_enabled && (
            <p className="text-sm text-slate-500 mb-6">
              Time limit: {currentModule.time_limit_minutes} minutes
            </p>
          )}
          <button
            onClick={beginCurrentModule}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-md hover:bg-blue-700 font-medium"
          >
            Begin Module
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'module_complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">Module Complete</h1>
          <p className="text-slate-600 mb-6">
            Great work! Ready to continue to the next module?
          </p>
          <button
            onClick={goToNextModule}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-md hover:bg-blue-700 font-medium"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'assessment_complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 mb-3">Assessment Complete!</h1>
          <p className="text-slate-600 mb-6">
            Thank you for completing the assessment.
          </p>
          <Link
            to={`/report/${attemptId}?token=${resumeToken}`}
            className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-md hover:bg-blue-700 font-medium"
          >
            View My Results
          </Link>
        </div>
      </div>
    )
  }

  // screen === 'in_progress'
  const currentQuestionId = orderedQuestionIds[currentQuestionIndex]
  const currentQuestion = currentQuestionId ? questionsById[currentQuestionId] : null

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="text-sm text-slate-600">
          {modules[currentModuleIndex]?.name} — Question {currentQuestionIndex + 1} of{' '}
          {orderedQuestionIds.length}
        </span>
        {secondsRemaining !== null && (
          <span
            className={`text-sm font-mono font-medium px-3 py-1 rounded ${
              secondsRemaining < 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {formatTime(Math.max(0, secondsRemaining))}
          </span>
        )}
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {errorMessage && <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
        {currentQuestion ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-lg text-slate-900 mb-6">
              <ContentBlockRenderer blocks={currentQuestion.content_blocks} />
            </div>

            <QuestionAnswerInput
              answerTypeCode={currentQuestion.answer_type_code}
              choices={currentQuestion.choices}
              value={answers[currentQuestion.question_id] ?? {}}
              onChange={(value) => saveCurrentAnswer(currentQuestion.question_id, value)}
            />

            <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
              <button
                onClick={() => goToQuestion(currentQuestionIndex - 1)}
                disabled={currentQuestionIndex === 0}
                className="text-sm bg-slate-200 text-slate-800 px-4 py-2 rounded-md hover:bg-slate-300 disabled:opacity-40"
              >
                ← Previous
              </button>

              {currentQuestionIndex < orderedQuestionIds.length - 1 ? (
                <button
                  onClick={() => goToQuestion(currentQuestionIndex + 1)}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => handleSubmitModule(false)}
                  className="text-sm bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Submit Module
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-slate-600">No questions in this module.</p>
        )}
      </main>
    </div>
  )
}
